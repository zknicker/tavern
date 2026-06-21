---
summary: Decision to use json-render Rich Response specs for visual assistant replies.
read_when:
  - changing Rich Response persistence, catalog, renderer, prompts, or rendered assistant replies
  - changing response activity kinds for app-rendered assistant UI
---

# Rich Responses use json-render specs

Tavern uses one json-render Rich Response island per assistant response. Rich Responses use a first-class `rich_response` activity kind, a Tavern-owned catalog of allowed components, and generated agent instructions assembled from that json-render catalog. Agents prefer visual rendering through a Rich Response spec in a code fence whose language is `spec`; the old render-tool path is removed instead of retained as a compatibility layer.

**Consequences**

The initial Rich Response Catalog contains Tavern-styled `Stack`, `Heading`, `Text`, `Separator`, and `Table` components plus the existing three chart displays and two calendar displays. `Stack` is vertical-only in v1 so Rich Responses stay chat-shaped and readable. Stored chat history, Runtime projection, Server rows, Website rendering, demos, tests, and generated instructions use Rich Response language instead of preserving old widget behavior. Prompt assembly and SpecStream compilation come from json-render core; Website rendering uses `@json-render/react`; Tavern keeps product-specific persistence, styling, and per-component validation.

The first implementation is a read-only chat subset. Tavern defines a json-render catalog and schema template for the current Rich Response Spec instead of hand-writing per-component examples. The Website renderer can execute broader json-render specs, but the generated prompt and Runtime validator do not expose interaction features such as repeat, events, watchers, visibility, and two-way state bindings until those fields are part of Tavern's persisted chat contract.

The json-render chat example is Tavern's reference implementation for mechanics: the agent emits a fenced JSONL spec, Runtime compiles complete patches while the assistant streams, the app renders one progressive island, and layout/text components compose multiple displays inside that island. Tavern borrows that flow while using Tavern-owned catalog schemas, app-styled Surface components, and stricter chat-first limits instead of the example's broad shadcn catalog.
