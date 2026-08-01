# HomeKind Prompt Catalogue

Lightweight, house-convention version of StudyKind's PROMPT-GOVERNANCE: prompt
changes must update this file in the same PR. Every production model
instruction lives in `prompts/*.ts` and is never assembled from a database,
CMS, or client-supplied string.

| ID | File | Model | Purpose | Data sent | Trust boundary |
| --- | --- | --- | --- | --- | --- |
| `HK-CHAT-001` | `prompts/device-chat.ts` (`buildDeviceChatSystem`) | `claude-sonnet-5` | Per-device chat, answering questions about one appliance from its manual | The device's manual PDF (fetched from Storage at user request only, i.e. when the user opens the chat for that device); `deviceLabel` string; the conversation's own messages | Manual PDF is user-provided document content, not instructions — the prompt explicitly tells the model to ignore any embedded instruction-like text in the manual |
| `HK-FETCH-001` | `prompts/manual-search.ts` (`buildManualSearchPrompt`) | `claude-sonnet-5` (web search tool) | Find the official manufacturer manual PDF for a device, to offer as an attach-candidate | `brand` and `model` strings only — no manual content, no household data | Web page content encountered during search is data to evaluate, never instructions — the prompt tells the model to ignore anything in a page that reads like a command |

## Governance note

Any change to the wording, structure, or trust-boundary language in
`prompts/device-chat.ts` or `prompts/manual-search.ts` must update the
matching row above in the same PR. If a change alters what data is sent to
the model (new field, new content type), call that out explicitly in the PR
description — this is the minimisation/data-flow gate, lightweight version of
StudyKind's PROMPT-GOVERNANCE rule 4.
