"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiFailureCode } from "@/lib/ai/errors";

const MAX_CONTENT_CHARS = 4000;
const CHAR_COUNTER_THRESHOLD = 3600;
const MAX_HISTORY_TURNS = 30;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  error?: string;
}

const FAILURE_COPY: Record<AiFailureCode, string> = {
  manual_missing: "This device needs a manual before you can chat about it.",
  manual_too_large: "This manual is too large for chat in this version. You can still read it from the device page.",
  budget_exhausted: "The household's AI allowance for this month has been used.",
  rate_limited: "The assistant is busy right now. Try again in a minute.",
  ai_disabled: "The assistant isn't switched on for this deployment.",
  no_api_key: "The assistant isn't switched on for this deployment.",
  api_error: "Something went wrong talking to the assistant. Try again in a moment.",
  refusal: "The assistant couldn't answer that one. Try rephrasing your question.",
};

// The page carries its own <h1>, so shift the model's markdown down a level
// to avoid a second h1 competing with it.
const chatMarkdownComponents: Components = {
  h1: (props) => <h2 {...props} />,
  h2: (props) => <h3 {...props} />,
  h3: (props) => <h4 {...props} />,
  h4: (props) => <h5 {...props} />,
  h5: (props) => <h6 {...props} />,
  h6: (props) => <h6 {...props} />,
};

/** Parses whatever text has arrived so far into complete SSE frames (blocks
 * separated by a blank line), returning the leftover partial frame so the
 * caller can prepend it to the next chunk. Never throws on a malformed
 * frame — it's just skipped. */
function parseSseFrames(buffer: string): { frames: { event: string | null; data: string }[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const frames: { event: string | null; data: string }[] = [];

  for (const block of parts) {
    let event: string | null = null;
    let data: string | null = null;
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice("data:".length).trim();
      }
    }
    if (data !== null) {
      frames.push({ event, data });
    }
  }

  return { frames, rest };
}

export function ChatPanel({
  deviceId,
  deviceLabel,
  manualFileName,
}: {
  deviceId: string;
  deviceLabel: string;
  manualFileName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const canSend = !isStreaming && input.trim().length > 0 && input.length <= MAX_CONTENT_CHARS;

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function streamTurn(history: ChatMessage[]): Promise<void> {
    setIsStreaming(true);
    setError(null);

    // Keep the wire payload bounded to the last N turns — the transcript
    // shown to the user can be longer, but the API only wants recent context.
    const wireMessages = history.slice(-MAX_HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content }));

    let response: Response;
    try {
      response = await fetch("/api/ai/device-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, messages: wireMessages }),
      });
    } catch {
      setIsStreaming(false);
      setError("Couldn't reach the assistant. Check your connection and try again.");
      return;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: AiFailureCode } | null;
      setIsStreaming(false);
      if (response.status === 401) {
        setError("Your session has expired. Refresh the page and sign in again.");
        return;
      }
      if (response.status === 400 || !body?.error) {
        setError("Something went wrong talking to the assistant. Try again in a moment.");
        return;
      }
      setError(FAILURE_COPY[body.error] ?? "Something went wrong talking to the assistant. Try again in a moment.");
      return;
    }

    if (!response.body) {
      setIsStreaming(false);
      setError("The assistant didn't respond. Try again in a moment.");
      return;
    }

    // Append an empty assistant turn and fill it in as chunks arrive.
    setMessages([...history, { role: "assistant", content: "" }]);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { frames, rest } = parseSseFrames(buffer);
        buffer = rest;

        for (const frame of frames) {
          if (frame.data === "[DONE]") continue;

          if (frame.event === "error") {
            let code: AiFailureCode | null = null;
            try {
              code = (JSON.parse(frame.data) as { code?: AiFailureCode }).code ?? null;
            } catch {
              code = null;
            }
            const note = code
              ? (FAILURE_COPY[code] ?? "Something went wrong partway through.")
              : "Something went wrong partway through.";
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, error: note };
              }
              return next;
            });
            continue;
          }

          try {
            const { text } = JSON.parse(frame.data) as { text?: string };
            if (typeof text === "string" && text.length > 0) {
              setMessages((current) => {
                const next = [...current];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: last.content + text };
                }
                return next;
              });
            }
          } catch {
            // Malformed data frame — skip it rather than breaking the stream.
          }
        }
      }
    } catch {
      setError("The response cut off partway through. You can try sending your last message again.");
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const nextHistory: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setInput("");
    void streamTurn(nextHistory);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <p className="hint">
        Answers come from this device&rsquo;s stored manual (&ldquo;{manualFileName}&rdquo;) and can make
        mistakes, so check anything important against the manual itself.
      </p>

      <div
        className="chat-transcript"
        role="log"
        aria-live={isStreaming ? "off" : "polite"}
        aria-label={`Conversation about ${deviceLabel}`}
        tabIndex={0}
      >
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          return (
            <div key={index} className={`chat-turn chat-turn-${message.role}`}>
              {message.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
                  {message.content}
                </ReactMarkdown>
              ) : (
                message.content
              )}
              {isLast && isStreaming && message.role === "assistant" ? (
                <span className="chat-caret" aria-hidden="true" />
              ) : null}
              {message.error ? (
                <p className="hint" style={{ color: "var(--coral-text)" }}>
                  {message.error}
                </p>
              ) : null}
            </div>
          );
        })}
        {messages.length === 0 ? (
          <p className="chat-loading" aria-hidden="true">
            Ask a question about {deviceLabel} to get started.
          </p>
        ) : null}
        <div ref={transcriptEndRef} />
      </div>

      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="chat-composer">
        <label className="sr-only" htmlFor="chat-input">
          Your message
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this device — Enter to send, Shift+Enter for a new line"
          disabled={isStreaming}
          rows={1}
        />
        <div className="chat-composer-row">
          {input.length > CHAR_COUNTER_THRESHOLD ? (
            <span className={`chat-char-count${input.length > MAX_CONTENT_CHARS ? " over" : ""}`}>
              {input.length.toLocaleString()} / {MAX_CONTENT_CHARS.toLocaleString()}
            </span>
          ) : (
            <span />
          )}
          <button className="button" type="button" onClick={handleSend} disabled={!canSend}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
