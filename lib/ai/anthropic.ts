import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import { buildDeviceChatSystem } from "@/prompts/device-chat";
import { buildManualSearchPrompt } from "@/prompts/manual-search";
import { AiCodedError, toFailureCode, type AiFailureCode } from "@/lib/ai/errors";

// This is the ONLY file in the codebase allowed to call the Anthropic SDK —
// a WattKind house rule mirroring StudyKind's PROMPT-GOVERNANCE rule 8
// ("keep provider calls behind a single module"). Every other package talks
// to the model through the functions exported here.

export const CHAT_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

/** Lazy singleton. Throws AiCodedError("no_api_key") if ANTHROPIC_API_KEY is
 * unset — callers should check aiEnabled() first to avoid hitting this in
 * the common case, but the throw is the backstop for direct callers. */
function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiCodedError("no_api_key", "ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const DISABLED_VALUES = new Set(["false", "0", "off", "no"]);

/** True when AI features may be used: AI_ENABLED is not explicitly disabled
 * AND an API key is configured. Routes should check this before doing any
 * AI work so "no key configured" and "explicitly disabled" both surface as
 * the same labelled ai_disabled state to the user, rather than an error. */
export function aiEnabled(): boolean {
  const flag = String(process.env.AI_ENABLED ?? "true").trim().toLowerCase();
  if (DISABLED_VALUES.has(flag)) return false;
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface DeviceChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Opens a streaming chat turn scoped to one device's manual.
 *
 * The manual PDF is attached only on the first user message, with
 * `cache_control: { type: "ephemeral" }` on the document block — rationale:
 * a single chat session sends the full manual on every turn (the Messages
 * API is stateless), and multi-turn conversations about the same device
 * reuse that exact prefix, so caching it lets turns 2+ hit Anthropic's
 * prompt cache instead of re-processing/re-billing the whole manual every
 * time. citations are left disabled — HK-CHAT-001 asks the model to cite
 * page numbers in its own prose instead of using the citations feature.
 */
export async function streamDeviceChat(opts: {
  manualPdfBase64: string;
  deviceLabel: string;
  messages: DeviceChatMessage[];
}): Promise<MessageStream> {
  const anthropic = getAnthropicClient();
  const system = buildDeviceChatSystem(opts.deviceLabel);

  if (opts.messages.length === 0) {
    throw new AiCodedError("api_error", "streamDeviceChat requires at least one message");
  }

  const messages: Anthropic.MessageParam[] = opts.messages.map((m, i) => {
    if (i !== 0 || m.role !== "user") {
      return { role: m.role, content: m.content };
    }
    // First user turn: attach the manual alongside the question.
    const content: Anthropic.ContentBlockParam[] = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: opts.manualPdfBase64,
        },
        cache_control: { type: "ephemeral" },
        citations: { enabled: false },
      },
      { type: "text", text: m.content },
    ];
    return { role: "user", content };
  });

  return anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system,
    messages,
  });
}

export type ManualCandidate =
  | { ok: true; url: string; title: string; source: string }
  | { ok: false; error: AiFailureCode };

/**
 * Non-streaming, best-effort web search for the official manufacturer
 * manual PDF for a brand+model. Never throws — every failure path (missing
 * key, disabled, provider error, unparseable response, non-https url)
 * returns { ok: false, error }.
 */
export async function findManualCandidate(opts: {
  brand: string;
  model: string;
}): Promise<ManualCandidate> {
  let anthropic: Anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch (err) {
    return { ok: false, error: toFailureCode(err) };
  }

  const prompt = buildManualSearchPrompt(opts.brand, opts.model);

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20260318",
          name: "web_search",
          max_uses: 3,
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: toFailureCode(err) };
  }

  if (response.stop_reason === "refusal") {
    return { ok: false, error: "refusal" };
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const candidate = parseManualCandidateJson(text);
  if (!candidate) {
    return { ok: false, error: "api_error" };
  }
  return candidate;
}

/** Defensively finds the last {...} block in `text` and parses it. The model
 * is asked for JSON-only output, but web-search turns can still preface the
 * final answer with stray text, so this scans from the end rather than
 * assuming text.trim() is valid JSON on its own. */
function parseManualCandidateJson(text: string): ManualCandidate | null {
  const lastOpen = text.lastIndexOf("{");
  if (lastOpen === -1) return null;
  const lastClose = text.lastIndexOf("}");
  if (lastClose === -1 || lastClose < lastOpen) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(lastOpen, lastClose + 1));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.found !== true) {
    return { ok: false, error: "manual_missing" };
  }
  const url = obj.url;
  const title = obj.title;
  const source = obj.source;
  if (typeof url !== "string" || typeof title !== "string" || typeof source !== "string") {
    return null;
  }
  if (!url.toLowerCase().startsWith("https://")) {
    return null;
  }
  return { ok: true, url, title, source };
}
