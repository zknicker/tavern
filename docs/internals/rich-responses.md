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
assembles the catalog-backed prompt with its default prompt assembler and
compiles SpecStream patches. The Website renders the compiled spec with
`@json-render/react` using Tavern-styled component renderers.

Tavern owns the component catalog and product rules, not a custom json-render
prompt template. Runtime accepts the json-render element fields the renderer
understands, including `repeat`, `on`, `watch`, `visible`, `state`, and dynamic
prop expressions. Tavern still restricts component types to its chat catalog and
does not accept model-authored HTML, JSX, CSS, or arbitrary imports.

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
    repeat?: { statePath: string; key?: string };
    on?: Record<string, unknown>;
    watch?: Record<string, unknown>;
    visible?: unknown;
  }>;
  state: Record<string, unknown>;
}
```

Runtime validates the root, element count, child references, component types,
and literal component props. When props contain json-render dynamic expressions
such as `$state`, `$item`, `$index`, `$bindState`, `$bindItem`, `$cond`, or
`$template`, Runtime persists them and lets `@json-render/react` resolve them
before Website validates the resolved component props.

While an assistant is streaming an open `spec` fence, Runtime compiles complete
SpecStream lines from `assistant.delta` events and publishes active
`rich_response` progress. Runtime hides the raw JSONL fence from live
`turn.replyUpdated` text. When the assistant completes, Runtime records the
final validated Rich Response activity and stores the assistant message without
the `spec` block. If the final `spec` block is malformed but the reply has
usable prose, Runtime strips the block and delivers the prose without creating a
Rich Response activity.

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
- `MerchBaseSalesChart`: Plugin-backed sales trend display. It is the
  preferred way to present MerchBase sales trends over a date range. It renders
  Sales as bars, royalties as a line, hover-driven active-day stats, and a date
  range selector for live re-queries. Daily ranges render every selected day;
  missing days render as zero-sales buckets, including the current selected
  day. Current-day sales requests default to a 10-day trend unless the user
  explicitly asks for a one-day chart.
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
turn. Invalid durable payloads render the fallback text plus a visible
unavailable state.

## Agent Guidance

Generated `AGENTS.md` gets its Rich Response section from the json-render
catalog prompt assembler. Tavern defines each component once in the shared
catalog with a description, child-slot metadata, and Zod props schema; prompt
text, Runtime compilation, and validation all read from that catalog instead of
duplicating per-component examples in generated instructions. Tavern appends
only product-specific rules such as chat compactness, `Stack` child ownership,
component-choice guidance, and avoiding identical prose inside and outside Rich Responses.
Detailed component schemas live in `packages/tavern-api/src/rich-responses`.

## Ownership

Canonical schemas and the json-render catalog live in
`packages/tavern-api/src/rich-responses`.

Runtime owns parsing final assistant content and writing `rich_response`
activity. Server owns row projection. Website owns the renderer and visual
components under `apps/website/src/rich-responses`.
