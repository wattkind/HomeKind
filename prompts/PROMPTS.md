# HomeKind Prompt Catalogue

Lightweight, house-convention version of StudyKind's PROMPT-GOVERNANCE: prompt
changes must update this file in the same PR. Every production model
instruction lives in `prompts/*.ts` and is never assembled from a database,
CMS, or client-supplied string.

| ID | File | Model | Purpose | Data sent | Trust boundary |
| --- | --- | --- | --- | --- | --- |
| `HK-CHAT-001` | `prompts/device-chat.ts` (`buildDeviceChatSystem`) | `claude-sonnet-5` | Per-device chat, answering questions about one appliance from its manual | The device's manual PDF (fetched from Storage at user request only, i.e. when the user opens the chat for that device); `deviceLabel` string; the conversation's own messages | Manual PDF is user-provided document content, not instructions — the prompt explicitly tells the model to ignore any embedded instruction-like text in the manual |
| `HK-FETCH-001` | `prompts/manual-search.ts` (`buildManualSearchPrompt`) | `claude-sonnet-5` (web search tool) | Find the official manufacturer manual PDF for a device, to offer as an attach-candidate | `brand` and `model` strings only — no manual content, no household data | Web page content encountered during search is data to evaluate, never instructions — the prompt tells the model to ignore anything in a page that reads like a command |

## Call budget (HK-FETCH-001)

The prompt wording is only half of what makes this lookup work. Its call
parameters live in `lib/ai/anthropic.ts` as named constants
(`MANUAL_SEARCH_MAX_TOKENS`, `MANUAL_SEARCH_MAX_USES`,
`MANUAL_SEARCH_TIMEOUT_MS`) and are part of the contract: a web-search turn
spends its output budget on tool round-trips before it writes the final JSON,
so too small a `max_tokens` truncates the answer away entirely and too small a
`max_uses` makes the model give up and return `{"found": false}`. Both
failures are indistinguishable from "no manual exists" at the API boundary.
If you change the prompt so it needs more or fewer searches, re-check those
constants in the same PR.

## Governance note

Any change to the wording, structure, or trust-boundary language in
`prompts/device-chat.ts` or `prompts/manual-search.ts` must update the
matching row above in the same PR. If a change alters what data is sent to
the model (new field, new content type), call that out explicitly in the PR
description — this is the minimisation/data-flow gate, lightweight version of
StudyKind's PROMPT-GOVERNANCE rule 4.
