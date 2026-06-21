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

Tavern uses json-render's default catalog prompt assembler instead of a custom prompt template. The persisted chat contract accepts json-render state, repeat, event, watcher, visibility, and dynamic-prop fields that `@json-render/react` can render. Tavern's constraints live in the component catalog and product-specific rules: only Tavern chat components are available, `Stack` owns child composition, and model-authored HTML, JSX, CSS, imports, class names, and tool names are not accepted.

The json-render chat example is Tavern's reference implementation for mechanics: the agent emits a fenced JSONL spec, Runtime compiles complete patches while the assistant streams, the app renders one progressive island, and layout/text components compose multiple displays inside that island. Tavern borrows that flow while using Tavern-owned catalog schemas, app-styled Surface components, and chat-first product rules instead of the example's broad shadcn catalog.
