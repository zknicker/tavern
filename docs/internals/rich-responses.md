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
newline-delimited JSON patches into a validated Rich Response Spec, and stores
the result as durable `rich_response` response activity.

The model does not call render tools. Tavern does not register first-party
render tools in the managed platform plugin.

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

Generated `AGENTS.md` tells agents to use Rich Responses by default for
tabular, chartable, calendar-shaped, or visually scannable final answers. It
lists the component catalog, shows compact spec examples, and explicitly tells
agents to use `Table` instead of Markdown tables when rows and columns are the
main display. Detailed component schemas live in
`packages/tavern-api/src/rich-responses`.

## Ownership

Canonical schemas live in `packages/tavern-api/src/rich-responses`.

Runtime owns parsing final assistant content and writing `rich_response`
activity. Server owns row projection. Website owns the renderer and visual
components under `apps/website/src/rich-responses`.
