---
summary: Rich Response architecture for json-render-style specs, typed component schemas, durable activity, and chat rendering.
read_when:
  - changing Rich Response persistence, generated agent guidance, specs, or renderer behavior
  - adding or changing Rich Response components, chart displays, calendar displays, or table rendering
  - changing how assistant final replies become app-rendered chat UI
---

# Rich Responses

Rich Responses let the assistant include one app-rendered UI island in a final
chat reply. The assistant writes normal Markdown plus one Rich Response spec in
a code fence whose language is `spec`.
Runtime strips the block from the delivered assistant message, compiles the
newline-delimited JSON patches through json-render SpecStream, validates the
compiled Rich Response Spec against Tavern's catalog schemas, and stores the
result as durable `rich_response` response activity.

The model does not call render tools. Tavern does not register first-party
render tools in the managed platform plugin.

Tavern uses json-render for the Rich Response spec island: json-render core
assembles the catalog-backed prompt and compiles SpecStream patches, and the
Website renders the compiled spec with `@json-render/react` using Tavern-styled
component renderers.

The current prompt and Runtime validator expose a read-only chat subset.
json-render interaction features such as `repeat`, `on`, `watch`, visibility,
and two-way bindings are renderer-capable, but Tavern does not ask agents to
emit them until the Runtime contract accepts and persists those fields.

## Contract

A `spec` block contains JSON patch lines:

```spec
{"op":"add","path":"/root","value":"summary"}
{"op":"add","path":"/elements/summary","value":{"type":"Stack","props":{"gap":"md"},"children":["title","body"]}}
{"op":"add","path":"/elements/title","value":{"type":"Heading","props":{"text":"Sales summary"},"children":[]}}
{"op":"add","path":"/elements/body","value":{"type":"Text","props":{"text":"43 sold, 36 net."},"children":[]}}
```

The compiled spec shape is:

```ts
{
  root: string;
  elements: Record<string, {
    type: RichResponseComponentType;
    props: Record<string, unknown>;
    children?: string[];
  }>;
  state: Record<string, unknown>;
}
```

Runtime validates the root, element count, child references, and component
types. Website validates component props again before rendering.

While an assistant is streaming an open `spec` fence, Runtime compiles complete
SpecStream lines from `assistant.delta` events and publishes active
`rich_response` progress. Runtime hides the raw JSONL fence from live
`turn.replyUpdated` text. When the assistant completes, Runtime records the
final validated Rich Response activity and stores the assistant message without
the `spec` block.

## Catalog

The initial catalog is intentionally small:

- `Stack`: vertical-only container with `gap: "sm" | "md" | "lg"`.
- `Heading`: chat-sized semibold text.
- `Text`: chat-sized normal or muted text.
- `Separator`: subtle horizontal rule.
- `Table`: high-level `columns` and `rows`; no row or cell primitives. It
  accepts keyed row objects and model-friendly matrix rows such as
  `columns: ["State", "Population"]` with `rows: [["California", "39,538,223"]]`.
- `BarChart`, `LineChart`, `ComposedChart`: existing chart displays with typed props.
- `CalendarDay`, `CalendarEvent`: existing calendar displays with typed props.

Rich Responses do not accept model-authored HTML, JSX, CSS, `className`, event
handlers, or arbitrary component imports.

## Storage

Runtime stores a valid Rich Response as response activity:

```ts
kind: "rich_response"
metadata: {
  richResponse: {
    component: "tavern.rich_response",
    fallback: { text: "Sales summary" },
    props: { spec },
    target: "chat.inline"
  }
}
```

Server projects `rich_response` activity into chat rows with a `richResponse`
payload. The Website transcript renders that row inline inside the assistant
turn. Invalid payloads render the fallback text plus a visible unavailable
state.

## Agent Guidance

Generated `AGENTS.md` gets its Rich Response section from the json-render
catalog prompt assembler. Tavern defines each component once in the shared
catalog with a description and Zod props schema; prompt text, Runtime
compilation, and validation all read from that catalog instead of duplicating
per-component examples in generated instructions. Tavern supplies a small
json-render schema template so the prompt describes only the read-only subset
the current renderer accepts. Detailed component schemas live in
`packages/tavern-api/src/rich-responses`.

## Ownership

Canonical schemas and the json-render catalog live in
`packages/tavern-api/src/rich-responses`.

Runtime owns parsing final assistant content and writing `rich_response`
activity. Server owns row projection. Website owns the renderer and visual
components under `apps/website/src/rich-responses`.
