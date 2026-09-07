import { createClient } from "@/lib/supabase/server";
import { streamDeviceChat, CHAT_MODEL, type DeviceChatMessage } from "@/lib/ai/anthropic";
import { getAiSettings } from "@/lib/ai/settings";
import { budgetExhausted, recordUsage } from "@/lib/ai/usage";
import { toFailureCode, type AiFailureCode } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 4000;
const MAX_MANUAL_BYTES = 30 * 1024 * 1024; // 30MB
const MAX_MANUAL_PAGES = 100;

interface ParsedBody {
  deviceId: string;
  messages: DeviceChatMessage[];
}

/** Validates the request body shape. Returns null (not a failure code) when
 * the request is malformed — that's a plain 400, distinct from the AI
 * failure-code taxonomy, since it's a client bug rather than an AI-layer
 * condition. */
function parseBody(body: unknown): ParsedBody | null {
  if (typeof body !== "object" || body === null) return null;
  const { deviceId, messages } = body as Record<string, unknown>;

  if (typeof deviceId !== "string" || !UUID_RE.test(deviceId)) return null;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;

  const parsedMessages: DeviceChatMessage[] = [];
  for (const m of messages) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0 || content.length > MAX_CONTENT_CHARS) return null;
    parsedMessages.push({ role, content });
  }

  return { deviceId, messages: parsedMessages };
}

function jsonFailure(error: AiFailureCode) {
  return Response.json({ ok: false, error }, { status: 200 });
}

function sseEvent(event: string | null, data: unknown): string {
  const dataLine = typeof data === "string" ? data : JSON.stringify(data);
  return event ? `event: ${event}\ndata: ${dataLine}\n\n` : `data: ${dataLine}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const parsed = parseBody(rawBody);
  if (!parsed) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // --- Preconditions: everything here must resolve BEFORE any bytes of the
  // SSE stream are sent, so the client can tell success from failure by
  // content-type alone (JSON vs text/event-stream), never by status code —
  // AI failures are never a 500.

  // The device lookup now comes FIRST because the AI gates are per-household
  // and need device.household_id to resolve. It is RLS-scoped via the
  // user-scoped client, so it also naturally excludes devices in a household
  // the caller isn't a member of — an unauthorised id is indistinguishable
  // from a missing one, exactly as before.
  const { data: device } = await supabase
    .from("devices")
    .select("id, household_id")
    .eq("id", parsed.deviceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!device) {
    return jsonFailure("manual_missing");
  }

  const aiSettings = await getAiSettings(device.household_id);
  if (!aiSettings.aiEnabled) {
    return jsonFailure("ai_disabled");
  }
  if (await budgetExhausted(aiSettings.budgetCapUsd)) {
    return jsonFailure("budget_exhausted");
  }

  const { data: manual } = await supabase
    .from("documents")
    .select("storage_path, size_bytes, page_count")
    .eq("device_id", device.id)
    .eq("type", "manual")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!manual) {
    return jsonFailure("manual_missing");
  }

  if ((manual.size_bytes ?? 0) > MAX_MANUAL_BYTES) {
    return jsonFailure("manual_too_large");
  }
  if (manual.page_count !== null && manual.page_count > MAX_MANUAL_PAGES) {
    return jsonFailure("manual_too_large");
  }

  // Download WITH the user-scoped client so storage RLS (device-documents
  // bucket policy) applies — never the admin client for this read.
  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from("device-documents")
    .download(manual.storage_path);

  if (downloadError || !pdfBlob) {
    return jsonFailure("manual_missing");
  }

  const manualPdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString("base64");

  // deviceLabel is cosmetic (used in the system prompt greeting) so a
  // missing name/brand degrades gracefully rather than failing the request.
  const deviceLabel = "your device";

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        const messageStream = await streamDeviceChat({
          manualPdfBase64,
          deviceLabel,
          messages: parsed.messages,
        });

        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            enqueue(sseEvent(null, { text: event.delta.text }));
          }
        }

        const finalMessage = await messageStream.finalMessage();

        await recordUsage({
          householdId: device.household_id,
          userId: user.id,
          purpose: "device_chat",
          model: finalMessage.model || CHAT_MODEL,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        });

        if (finalMessage.stop_reason === "refusal") {
          enqueue(sseEvent("error", { code: "refusal" satisfies AiFailureCode }));
        }
      } catch (err) {
        // No manual content or message text is ever logged here — only the
        // error's own class/status, via toFailureCode.
        const code = toFailureCode(err);
        console.error("device-chat stream failed", code);
        enqueue(sseEvent("error", { code }));
      } finally {
        enqueue("data: [DONE]\n\n");
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
