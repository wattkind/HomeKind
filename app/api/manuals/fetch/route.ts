import net from "node:net";
import { createClient } from "@/lib/supabase/server";
import { findManualCandidate, CHAT_MODEL } from "@/lib/ai/anthropic";
import { getAiSettings } from "@/lib/ai/settings";
import { budgetExhausted, recordUsage } from "@/lib/ai/usage";

// Node runtime (not edge) — this route makes an outbound fetch to an
// arbitrary manufacturer host and streams a PDF back, which needs Node's
// networking/streaming primitives.
export const runtime = "nodejs";

// 300s, not the previous 60s. The search step calls the model with the
// server-side web_search tool, and a measured lookup of a real appliance took
// 1m51s at max_uses=5 (see MANUAL_SEARCH_TIMEOUT_MS in lib/ai/anthropic.ts) —
// so the old 60s ceiling was below the feature's normal running time and would
// have cut off a lookup that was working.
//
// DEPLOYMENT CAVEAT: 300s needs a platform that allows it. Vercel's Hobby plan
// caps a Node function at 60s, so auto-fetch cannot complete there; it needs a
// plan/runtime with a longer limit. Self-hosted `next start` (the BarnyardServer
// deployment) has no such ceiling. The confirm step is a plain PDF download and
// is comfortably inside any limit — only the search step is affected.
export const maxDuration = 300;

const MAX_FIELD_LEN = 120;
const MAX_URL_LEN = 2048;
const MAX_PDF_BYTES = 30 * 1024 * 1024; // 30MB hard cap on any fetched manual
const FETCH_TIMEOUT_MS = 15000;
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

// Silent-fallthrough contract (PRD phase 3b): this whole feature is a
// best-effort convenience on top of manual upload. The client never shows an
// error for it — every failure short of "malformed request"/"unauthenticated"
// comes back as a plain 200 { ok: false } and the client just falls back to
// the upload control. No URL/title is ever logged.
function fallback(): Response {
  return Response.json({ ok: false }, { status: 200 });
}

function invalidRequest(): Response {
  return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
}

function unauthenticated(): Response {
  return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
}

function isValidField(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= MAX_FIELD_LEN;
}

// NOTE: the auto-fetch gate used to live here as a bare
// `process.env.NEXT_PUBLIC_AUTOFETCH_ENABLED === "false"` check. It is now
// resolved per-household by lib/ai/settings.ts (deployment env ANDed with the
// household's own toggle), because the switch is a product setting rather
// than a deployment-only one. The env var still acts as a hard ceiling there.

/** True if `hostname` is a raw IP literal (v4 or v6), e.g. "127.0.0.1" or
 * "[::1]" — used to block requests aimed directly at an IP rather than a
 * name (a common way to reach cloud-metadata/internal endpoints). */
function isIpLiteralHostname(hostname: string): boolean {
  const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return net.isIP(bare) !== 0;
}

/** Blocks the well-known "this is obviously not a public manufacturer site"
 * hostname patterns: localhost itself, and the *.local / *.internal TLD-like
 * suffixes conventionally used for LAN/internal-only hosts. */
function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h.endsWith(".local") || h.endsWith(".internal");
}

/**
 * SSRF hardening, step 1: validate a candidate URL BEFORE ever fetching it.
 * Applied both to the model's initial suggestion and again to the final
 * response URL after following redirects (see fetchValidatedManual) — a
 * clean starting URL says nothing about where a redirect might send us.
 */
function validateManualUrl(rawUrl: string): { ok: true; url: URL } | { ok: false } {
  // (a) must parse as a URL at all.
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false };
  }
  // (b) https only — no http, file:, data:, ftp:, etc.
  if (url.protocol !== "https:") return { ok: false };
  // (c) hostname must not be a bare IP literal.
  if (isIpLiteralHostname(url.hostname)) return { ok: false };
  // (d) hostname must not be localhost / *.local / *.internal.
  if (isBlockedHostname(url.hostname)) return { ok: false };
  return { ok: true, url };
}

function startsWithPdfMagic(buf: Uint8Array): boolean {
  if (buf.length < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (buf[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

interface ValidatedManual {
  finalUrl: string;
  contentType: string | null;
  /** A single stream carrying the ENTIRE body (peeked bytes + the rest),
   * still enforcing MAX_PDF_BYTES as it's read. Never buffered in full. */
  body: ReadableStream<Uint8Array>;
}

/**
 * Full SSRF-hardened fetch pipeline for a candidate manual URL. Used for
 * BOTH the metadata-only lookup and the confirm/stream step — the confirm
 * step calls this again from scratch on the client-echoed url, never
 * trusting the first call's result.
 */
async function fetchValidatedManual(rawUrl: string): Promise<ValidatedManual | null> {
  const initial = validateManualUrl(rawUrl);
  if (!initial.ok) return null;

  let response: Response;
  try {
    response = await fetch(initial.url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!response.ok || !response.body) return null;

  // Re-validate the FINAL url (after any redirects) against the same rules
  // — a clean starting host can still redirect to an internal one.
  const finalCheck = validateManualUrl(response.url);
  if (!finalCheck.ok) return null;

  // Size guard #1: trust but verify the declared Content-Length, if present.
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLen = Number(contentLengthHeader);
    if (Number.isFinite(declaredLen) && declaredLen > MAX_PDF_BYTES) return null;
  }

  const contentType = response.headers.get("content-type");

  // Read just enough of the body to check the PDF magic bytes (regardless
  // of what Content-Type claims), folding those bytes into the same running
  // byte-cap counter ("total") used for the rest of the stream below.
  const sourceReader = response.body.getReader();
  const peekChunks: Uint8Array[] = [];
  let peekedLen = 0;
  let total = 0;
  let sourceDone = false;

  while (peekedLen < PDF_MAGIC.length && !sourceDone) {
    const result = await sourceReader.read();
    sourceDone = result.done;
    if (result.value) {
      total += result.value.byteLength;
      if (total > MAX_PDF_BYTES) {
        await sourceReader.cancel();
        return null;
      }
      peekChunks.push(result.value);
      peekedLen += result.value.byteLength;
    }
  }

  const peeked = concatChunks(peekChunks);
  const declaresPdf = contentType?.toLowerCase().includes("application/pdf") ?? false;
  if (!startsWithPdfMagic(peeked) && !declaresPdf) {
    await sourceReader.cancel();
    return null;
  }

  // Stitch the peeked chunks back onto the front of the stream so the
  // caller sees the complete, untouched body — still capped as it's read.
  // This never buffers the whole PDF: only the few bytes needed for the
  // magic-number check are ever held at once beyond normal chunk size.
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of peekChunks) controller.enqueue(chunk);
      if (sourceDone) controller.close();
    },
    async pull(controller) {
      if (sourceDone) {
        controller.close();
        return;
      }
      const result = await sourceReader.read();
      if (result.done) {
        sourceDone = true;
        controller.close();
        return;
      }
      total += result.value.byteLength;
      if (total > MAX_PDF_BYTES) {
        await sourceReader.cancel();
        controller.error(new Error("manual exceeds size cap"));
        return;
      }
      controller.enqueue(result.value);
    },
    cancel() {
      void sourceReader.cancel();
    },
  });

  return { finalUrl: response.url, contentType, body };
}

/** Fully drains a validated stream just to count its total bytes (metadata
 * mode never stores the PDF). Bounded by MAX_PDF_BYTES already enforced
 * inside fetchValidatedManual, so this can't run away. */
async function drainAndCount(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
  }
  return total;
}

/** Cosmetic filename only — never used for anything security-sensitive. */
function sanitizeFilename(title: string): string {
  const base =
    title
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .slice(0, 80) || "manual";
  return `${base}.pdf`;
}

interface AuthedContext {
  householdId: string;
  userId: string;
}

async function handleSearch(rawBody: unknown, ctx: AuthedContext): Promise<Response> {
  if (typeof rawBody !== "object" || rawBody === null) return invalidRequest();
  const { brand, model } = rawBody as Record<string, unknown>;
  if (!isValidField(brand) || !isValidField(model)) return invalidRequest();

  const aiSettings = await getAiSettings(ctx.householdId);
  if (!aiSettings.autoFetchEnabled) return fallback();
  if (await budgetExhausted(aiSettings.budgetCapUsd)) return fallback();

  const candidate = await findManualCandidate({ brand, model });

  // Record spend whenever we actually got a model response, whether or not
  // it yielded a usable candidate (a refusal/unparsable reply still costs
  // tokens) — see the optional `usage` field added to ManualCandidate.
  if (candidate.usage) {
    await recordUsage({
      householdId: ctx.householdId,
      userId: ctx.userId,
      purpose: "manual_fetch",
      model: CHAT_MODEL,
      inputTokens: candidate.usage.inputTokens,
      outputTokens: candidate.usage.outputTokens,
    });
  }

  if (!candidate.ok) return fallback();

  // Never trust the model's URL at face value — run it through the same
  // SSRF-hardened fetch pipeline the confirm step uses, and only report
  // metadata (never store anything) here.
  const validated = await fetchValidatedManual(candidate.url);
  if (!validated) return fallback();

  const sizeBytes = await drainAndCount(validated.body);

  let hostname: string;
  try {
    hostname = new URL(validated.finalUrl).hostname;
  } catch {
    hostname = candidate.source;
  }

  return Response.json(
    {
      ok: true,
      url: validated.finalUrl,
      title: candidate.title,
      source: hostname,
      sizeBytes,
    },
    { status: 200 },
  );
}

async function handleConfirm(rawBody: unknown, ctx: AuthedContext): Promise<Response> {
  if (typeof rawBody !== "object" || rawBody === null) return invalidRequest();
  const { url, title } = rawBody as Record<string, unknown>;
  if (typeof url !== "string" || url.length === 0 || url.length > MAX_URL_LEN) return invalidRequest();

  // Re-checked on confirm, not just on search: the toggle could have been
  // turned off between the two calls, and confirm is the step that actually
  // pulls bytes from an arbitrary host.
  const aiSettings = await getAiSettings(ctx.householdId);
  if (!aiSettings.autoFetchEnabled) return fallback();

  // Full re-validation of the SAME pipeline as the metadata step — this url
  // is just an echo of what the client was shown, never trusted as-is.
  const validated = await fetchValidatedManual(url);
  if (!validated) return fallback();

  const filename = sanitizeFilename(typeof title === "string" ? title : "");

  // Stream straight through — never buffer the whole PDF into one Buffer,
  // so memory stays bounded regardless of manual size.
  return new Response(validated.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const confirm = requestUrl.searchParams.get("confirm") === "1";

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return invalidRequest();
  }

  // Auth is required for both modes, ahead of any feature gate — this route
  // fetches arbitrary internet URLs server-side and must not be usable by a
  // signed-out caller as an open proxy.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthenticated();

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return unauthenticated();

  const ctx: AuthedContext = { householdId: membership.household_id, userId: user.id };

  if (confirm) {
    return handleConfirm(rawBody, ctx);
  }

  return handleSearch(rawBody, ctx);
}
