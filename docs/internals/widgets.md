---
summary: Tavern Widget architecture for tagged widget fences, per-widget props schemas, durable widget activity, and chat rendering.
read_when:
  - changing Widget persistence, generated agent guidance, fence parsing, or renderer behavior
  - adding or changing Widgets, chart displays, calendar displays, or table rendering
  - changing how assistant final replies become app-rendered chat UI
---

# Widgets

Widgets let the assistant include app-rendered UI blocks in a final chat reply.
The assistant writes normal Markdown plus one fenced code block per widget whose
language is `widget:<name>` — or the bare `artifact` language for the durable
artifact tier — containing exactly one JSON object of props:

````markdown
```widget:bar-chart
{"title":"Weekly sales","xKey":"day","series":[{"key":"sold","label":"Sold"}],"data":[{"day":"Mon","sold":4}]}
```
````

Runtime strips every widget fence from the delivered assistant message,
validates each payload against the widget's props schema, and stores each valid
widget as durable `widget` response activity. The model does not call render
tools, author layout trees, or emit HTML, JSX, CSS, class names, or imports.
Interactivity is authored in the app-owned React component, never in the
model-provided payload.

## Contract

Widget names are kebab-case and map one-to-one to durable component ids
`tavern.widget.<name>`. The stored render envelope is:

```ts
{
  component: `tavern.widget.${name}`,
  fallback: { text: string },
  props: <widget props, validated per widget>,
  target: "chat.inline"
}
```

A reply may contain multiple widget fences; each becomes its own activity in
fence order. An invalid fence (unknown name, malformed JSON, or props that fail
the schema) is stripped from the visible reply and produces no activity; the
prose still delivers. While an assistant is streaming, Runtime hides open and
closed widget fences from live reply text; a widget renders when the turn
completes.

Fallback text is derived at parse time: the `title` prop when present,
otherwise a widget-specific summary (table column labels, agenda date), and is
stored in the envelope plus the activity `summary`/`detail`.

## Catalog

- `table`: high-level `columns` and `rows`. Accepts keyed row objects and
  model-friendly matrix rows such as `columns: ["State", "Population"]` with
  `rows: [["California", "39,538,223"]]`.
- `bar-chart`, `line-chart`, `composed-chart`: chart displays with typed props.
- `calendar-event`, `calendar-day`: calendar displays with typed props.
- `html-preview`: sandboxed inline preview of an agent-authored workspace HTML
  file — the escape valve for custom visuals the closed catalog does not cover.
  Props are `{ path, height?, title? }`; the path must be workspace-relative
  with confined segments and an `.html`/`.htm` extension, and the height is
  clamped to 120–1200px (default 480). The Website fetches the file through the
  same confined Runtime workspace read the artifact pane uses (realpath
  confinement to the sending agent's workspace, secret-file blocks, complete
  reads up to 5 MiB) and renders it in an opaque-origin iframe (`srcDoc`,
  scripts allowed, never `allow-same-origin`). The iframe background is
  transparent — the document owns its own styling over the app surface. The
  file must be self-contained:
  inline CSS/JS only, no sibling or external asset references. Rendering is
  live — the widget shows the file's current content at render time, not a
  snapshot, so later edits or deletion change what historical chats display.
- `artifact`: the durable artifact tier — an agent-authored single-file TSX
  page that opens in the artifact pane. Authored as a bare ```` ```artifact ````
  fence (not `widget:`-prefixed; the name reads in the visuals-vs-artifacts
  vocabulary, and the fence funnels into the same widget machinery as
  `tavern.widget.artifact`). Props are `{ path, title? }` with the same
  confinement shape as `html-preview`, except the path must end in `.tsx` and
  the complete-read cap is the 512 KiB workspace text-read window; there is no
  height — the pane owns sizing. The transcript renders a compact card (title,
  kind, open affordance) and never the page itself; opening the card focuses
  the pane's workspace tab, where the `.tsx` pane renderer compiles the file
  inside the same opaque-origin iframe (page runtime: sucrase compile, React
  plus the `@tavern/kit` bundle built from `apps/website/src/kit`). Exactly
  two import sources resolve — `react` and `@tavern/kit` — and any other
  specifier, URLs above all, fails the compile and renders the error plus the
  fenced source instead of a partial page. Tavern tokens ride into the iframe
  (light and dark, following the app scheme). Rendering is live file state,
  same replay caveat as `html-preview`. See [kit-pages.md](kit-pages.md) for
  the authoring contract.
- `merchbase-sales-chart`: Plugin-backed sales trend display. Fetches live
  MerchBase data, renders sales as bars and royalties as a line, and includes a
  date range selector. Current-day sales requests default to a 10-day trend
  unless the user explicitly asks for a one-day chart.

There are no model-authored layout or text primitives: prose around the fence
carries the narrative, and each widget owns its presentation.

Plugin-owned Widget source may live under the owning Plugin's folder. The
widget still enters Tavern through build-time registration in the typed props
schema map and Website renderer; Plugin manifests declare their widgets under
`widgets`. Enabling a Plugin, and granting it to an agent, controls whether the
agent may author that Plugin's widgets; the App does not dynamically load
widget code from enabled Plugin records. If the Plugin is globally disabled,
Plugin-backed interaction controls inside historical renders are disabled.

## Storage

Runtime stores each valid widget as response activity:

```ts
kind: "widget"
title: <widget display name>
metadata: {
  widget: { component, fallback, props, target },
  runtime: { agentId, messageId, runId, sessionKey, source, startedAt }
}
```

Server projects `widget` activity into chat rows with a `widget` payload. The
Website transcript renders that row inline inside the assistant turn. Invalid
durable payloads render the fallback text plus a visible unavailable state.

Legacy `rich_response` activity from the retired json-render Rich Response
system is dropped by a one-time Runtime schema repair; old chats keep their
prose.

## Agent Guidance

The Tavern-managed system prompt carries one compact Widgets section: the fence
format, decision rules (use a widget when the answer is table-, chart-, or
calendar-shaped), and a short signature per widget. The full guidance is
hand-written and costs roughly 800 tokens for all widgets.

The prompt is assembled, not one static string. Each widget contributes a
`WidgetPromptEntry` (`{ description, signature, constraints? }`) to a map in
`packages/tavern-api/src/widgets/prompt.ts`, guarded by
`satisfies Record<WidgetName, WidgetPromptEntry>` so a widget cannot be added to
the schema without also teaching the agent to author it. Plugin-owned entries
live beside their schema (see the merchbase entry) and are gated in by the
caller. `renderWidgetsPrompt(names)` renders the shared preamble plus only the
listed widgets' entries, in canonical order.

Which widgets an agent sees is scoped to its grants:
`availableWidgetNamesForAgent` (Runtime) returns core widgets (owned by no
Plugin) always, plus each Plugin's widgets only when that Plugin is enabled and
granted to the agent. Runtime computes this in `generateAgentInstructions`, so
an agent without the MerchBase grant never sees the MerchBase widget and does
not pay its tokens. Preview and turn use the same path, so they never diverge.

## Ownership

Canonical widget names, props schemas, the render envelope, and the prompt live
in `packages/tavern-api/src/widgets`. Runtime owns fence parsing of final
assistant content and writing `widget` activity
(`apps/runtime/src/widgets/render.ts`). Server owns row projection
(`apps/server/src/widgets/widgets.ts`). Website owns the renderers
(`apps/website/src/widgets`), including Plugin-owned renderers imported from
first-party Plugin folders. Renderers are thin wrappers that map fence props
onto the shared Tavern component kit (`apps/website/src/kit`, see
[kit.md](kit.md)), which owns the visual components. The artifact tier's
in-iframe compiler and kit bundle live under
`apps/website/src/widgets/page-runtime/` and are built from the kit sources by
`apps/website/scripts/build-page-runtime.ts`; the pane renderer for `.tsx`
files lives with the other pane renderers in
`apps/website/src/features/chats/` (see [kit-pages.md](kit-pages.md)).
