---
summary: Widget architecture for typed chat widgets, explicit host adapters, schemas, fallbacks, chart widgets, and calendar widgets.
read_when:
  - adding or changing Widgets in chat or sidebar
  - adding a widget folder, host adapter, ui.render contract, or render fallback
  - changing how Hermes stream events project into Tavern widget rows
---

# Widgets

Widgets let the assistant produce app-rendered UI inside chat or sidebars
without giving the model arbitrary HTML, JSX, CSS, or component trees. The model
emits a typed render request; Tavern validates it and renders a known component.

## Event path

The native path is:

1. Hermes event stream emits a `ui.render` payload.
2. Tavern Runtime projects the payload into durable `widget` response activity.
3. Tavern App reads the row through the normal chat timeline.
4. The transcript resolves the component through Tavern's explicit Website widget adapter.

`ui.render` is not model-only. Any trusted Runtime path can produce it, including
Hermes turn output, Tavern tool projection, or a future runtime helper. Every
producer uses the same contract and validation path.

Agents should not hand-author raw `ui.render` JSON. The agent-facing path is a
narrow Widget tool such as `render_bar_chart`, `render_line_chart`, or
`render_composed_chart`, with a typed schema. Runtime validates the tool input
and records the same durable Widget render payload.

Do not add a generic `tavern.render_widget` tool. One widget component gets one
typed tool until a real repeated pattern appears.

Tool names stay short and provider-safe; component ids stay Tavern-namespaced
for durable rendering. For example, the agent calls `render_bar_chart`, and
Runtime projects that into `component: "tavern.render_bar_chart"`.

The Charts family includes real agent-facing tools. A successful chart Widget
tool call records durable `widget` response activity and
returns a short tool result such as `{"status":"rendered"}`.

Widget tools return status, not the full payload. The agent already supplied the
data, and the durable widget payload belongs in Tavern response activity.
The tool schema and tool description are the agent-facing contract. Do not rely
on a skill, prompt note, or `AGENTS.md` blurb as the only way an agent learns how
to render a widget.
Tavern does not assume Hermes always includes every tool description in model
context. Correctness comes from the tool schema, Runtime validation, and
agent-visible validation failures.

Agent-facing Widget guidance should be phrased as a capability list, not repo
architecture notes. Put that guidance in Tavern's generated agent `AGENTS.md`
content (`apps/runtime/src/workspace/managed-instructions.ts`), so it travels
with the managed Tavern agent:

```md
You can render Widgets using tool calls. Widgets give the user a richer display
of important information.

When a render tool is available and data is clearly visual, prefer a Widget: use
line charts for trends and time series, bar charts for categorical comparisons
and rankings, composed charts for bars plus lines on one ordered x-axis,
calendar events for prepared single events, and calendar days for prepared daily
agendas.

If no render tool is available, use concise text or a compact table.

Available Widgets:

* `render_bar_chart`: bar chart for categorical comparisons, rankings, totals,
  and bucketed numeric data.
* `render_line_chart`: line chart for trends, time series, ordered numeric data,
  and recent metric context.
* `render_composed_chart`: composed bar and line chart for ordered data where
  bars and lines share one x-axis.
* `render_calendar_day`: prepared calendar day with same-day events.
* `render_calendar_event`: single prepared calendar event, including simple when
  or where answers; preserve source start/end date, dateTime, and timeZone
  fields.
```

As Tavern adds weather or other Widget families, append their
description and tool call to this list. Keep the wording about what the agent can
do, not where code lives.

Keep the generated Widget list token-cheap: one short bullet per tool. Detailed
examples, schema explanations, and implementation notes belong in docs and
tests, not the generated `AGENTS.md` prompt.

The Charts implementation adds this section to the generated agent
`AGENTS.md` content, alongside the actual chart Widget tools.
Maintain the generated `AGENTS.md` Widget section manually. Do not generate it
from a centralized widget registry.

Invalid Widget tool input fails the tool call before widget activity is
recorded. The agent sees the schema failure and may retry with corrected data.
Failed Widget tool calls use normal failed-tool presentation and do not create a
widget row. Harmless shape mismatches can be normalized at the tool boundary
when the intent is unambiguous.

The raw `ui.render` contract requires `fallback.text`, but chart Widget tools do
not ask the agent for fallback copy. Runtime generates deterministic fallback
text from the validated chart title.

The bar and line chart tool input shape matches common chart-ready data:

```ts
{ title, data, x, y, unit? }
```

Runtime normalizes accepted chart tool input into stored render props, then wraps
those props with `target`, `component`, and generated fallback text. `y` may be
one numeric key or an array of up to four numeric keys.

The composed chart tool uses the same prepared `data`, `title`, `x`, and
optional `unit`, plus separate `barY` and `lineY` keys. Use `barUnit` and
`lineUnit` when bars and lines use different units; `unit` remains the shared
display unit when both series groups use the same unit. Each y field accepts one
numeric key or an array, with up to four total series across bars and lines.

The chart tool accepts already-prepared chart data only. It does not query,
aggregate, read files, run SQL, call external APIs, or accept domain-specific
data references.

Bar chart `y` values should be finite nonnegative JSON numbers. Line chart `y`
values should be finite JSON numbers. Composed chart `barY` values should be
finite nonnegative JSON numbers, while `lineY` values should be finite JSON
numbers on their secondary y-axis. Numeric strings such as `"12"` are accepted
at the tool boundary and normalized before widget activity is recorded.
Non-numeric strings are invalid.

Built-in Widget tools are Tavern-owned built-in tools, available to every Tavern
agent by default. They render validated UI into the current chat, do not execute
code, read files, call network services, or mutate external state, and do not
require a permission prompt. Do not present Charts as a plugin, toolset, or
installable kit.

Widget tools render into the current chat turn only. Tool input does not include
`chatId`, `responseId`, `sessionKey`, or other routing fields; Runtime already
knows the active chat, response, session, and agent.

The widget row is the visible result. If Hermes also emits normal tool
started/completed events for a chart Widget tool, storage still records
the truthful transcript. The App may hide or collapse that tool row only in the
primary chat presentation to avoid duplicating the widget.

Widgets live in the ordered chat stream like other response activity. Runtime
records a `ui.render` event as durable `widget` activity as soon as it arrives,
so widgets can appear mid-turn while the agent is still working. Missed live
events recover through `chat.log.list`; the widget row is not websocket-only
state and is not embedded inside final assistant Markdown.

## Folder shape

A widget has one canonical definition folder. Layer-specific files are host
adapters, not the widget implementation.

```text
packages/tavern-api/src/widgets/charts/*
```

The widget definition owns the small cross-layer contract:

| Piece | Contract |
| --- | --- |
| Metadata | Component ids and target support. |
| Schemas | Agent-facing input schemas plus parsed component props. |

Durable Widget docs live in the routed docs tree, not inside widget code
folders.

The canonical folder stays contract-shaped:

```text
packages/tavern-api/src/widgets/charts/
  contracts.ts
```

Test fixtures live with the tests that need them. Promote shared fixtures or
eval examples into the widget folder only after multiple tests or tooling paths
reuse the same payloads.

It must not import Runtime, Server, React, or app component code. Runtime
projection, Server row mapping, and Website rendering stay in host adapters.
The widget definition says what Charts means; the host adapters decide how each
Tavern layer consumes it.

Widget definitions do not export Runtime, Server, or React adapter interfaces.
Each host defines the small local adapter type it needs. `@tavern/api` stays the
contract package, not a widget framework.

`@tavern/api` does not own a global Widget registry. It exports ids, schemas,
and types. Runtime, Server, and Website each own the small explicit registry or
switch needed by that host.

Widgets do not expose a generic layout DSL. A model chooses a component id and
typed props; Tavern chooses chart internals, spacing, colors, actions, and
rendering behavior.

Each host layer gets only a small adapter:

```text
apps/runtime/src/widgets/render.ts
apps/runtime/src/widgets/charts.ts
apps/server/src/widgets/widgets.ts
apps/server/src/widgets/charts.ts
apps/website/src/widgets/charts.tsx
```

Adapters connect the widget definition to existing Runtime event projection,
Server row mapping, or Website rendering. If an adapter grows beyond glue code,
move the product contract back into the widget definition or the visual code
back into normal frontend components.

Host adapters wire widgets with explicit imports and plain records or switches:

```ts
const websiteWidgets = {
  "tavern.render_bar_chart": renderChartWidget,
};
```

Do not add manifest discovery, dynamic loading, plugin installation, or a widget
package runtime. A widget is wired by importing it in the host layer.

Generic host code owns the fallback after registered adapters decline a payload.
For example, Server projection parses the `ui.render` envelope in
`apps/server/src/widgets/widgets.ts`, then asks the Charts adapter whether it
owns the component. Do not make a family-specific adapter consume all widgets.

Frontend UI primitives stay with the app's component library. For the chart
widget, bklit-backed chart components live under
`apps/website/src/components/charts/*`; the Website adapter only maps validated
widget props to those app-owned chart components.

## Development demos

Widgets do not own a separate lab surface. Dev-only UI demonstrations are real
seeded Runtime chats; see [Chat demos](chat-demos.md). Add a Widget demo by
seeding a chat with durable widget response activity, not by adding a static
route fixture.

## Adding a Widget

Use this checklist when adding a widget component:

1. Add or update `packages/tavern-api/src/widgets/<family>/contracts.ts` with
   the component id, tool name, strict stored props schema, and forgiving tool
   input schema when normalization is useful.
2. Add the agent-facing tool to the managed Tavern Messenger plugin with a
   compact description, JSON schema, validation, and short status result.
3. Project successful tool completion into durable `widget` response activity in
   Runtime. Store normalized props, not raw agent input.
4. Wire generic `ui.render` through Runtime's widget activity helper when the
   widget can arrive as a render event.
5. Add the Server host adapter entry so known components validate props and
   unknown or invalid components render fallback rows.
6. Add the Website adapter and render with app-owned components, tokens, and
   `WidgetFrame` when the widget appears inline in chat.
7. Add one short generated `AGENTS.md` bullet for the tool. Keep detailed
   examples in docs and tests, not prompt text.
8. Seed a dev chat demo with the real tool name, component id, normalized widget
   props, and durable widget activity.
9. Add focused tests for contract parsing, tool schema/guidance, Runtime
   projection, Server fallback, Website rendering, and generated instructions.

Maintain parity across these surfaces. If the tool boundary accepts normalized
input such as numeric strings, the generated plugin, TypeScript schema, Runtime
projection, generated `AGENTS.md` bullet, docs, and demo payload should all tell
the same story.

## Render contract

`ui.render` is the generic event envelope for all widgets. The component id and
validated props carry the widget-specific meaning.

`ui.render` carries one widget:

```jsonc
{
  "target": "chat.inline",
  "component": "tavern.render_bar_chart",
  "props": {},
  "fallback": {
    "text": "Quarterly Revenue"
  }
}
```

Rules:

* `target` is `chat.inline`.
* `component` is a registered component id.
* `props` are validated by the component schema before rendering.
* `fallback.text` is required durable text for unknown or invalid widgets.
* Invalid widgets render the fallback plus a clear error state, not raw payloads.

The component id is the routing key. V1 does not include a separate `version`
field or `v1` suffix. If a future breaking change is needed, add a new
agent-facing tool and component id pair such as `render_bar_chart_v2` and
`tavern.render_bar_chart_v2`.

The first implementation accepts only `chat.inline`. Do not accept sidebar,
modal, drawer, toast, or other targets until their persistence and replay
semantics are designed.

Do not add chart-specific stream events such as `chart.render`. Runtime and
Server should only need to recognize that a typed widget render request exists;
widget definitions own the component-specific contract.

Validate widget payloads at both durable and render boundaries:

* Server projection validates the widget before emitting a `widget` timeline
  row. Invalid or unknown widgets become fallback rows with error state.
* Website adapters validate again before rendering React. Cached client data and
  external callers are still untrusted.

Runtime can preserve the render request as event metadata unless it needs to
reject a malformed envelope at ingestion.

Runtime stores valid render requests as first-class `widget` response activity,
not as generic `custom` activity with hidden widget metadata. Server row mapping
projects `widget` activity into transcript widget rows.

The durable widget render request lives in response activity metadata for v1:

```ts
kind: "widget"
metadata: {
  widget: {
    target: "chat.inline",
    component: "tavern.render_bar_chart",
    props,
    fallback: { text }
  }
}
```

Do not add widget-specific activity columns until the payload needs querying
outside chat replay.

Widget props are durable historical payload, not a cache of live source data.
Old widgets replay exactly from stored props. If source data changes, the old
widget does not silently change.

Invalid props for a known component can remain in durable activity metadata as
execution evidence, but projected render rows must not expose invalid props to
React renderers. The user-facing row shows fallback text plus error state.

Projected widget rows expose props only when validation succeeds:

```ts
validationError === null // props are renderable
validationError !== null // props are null
```

Hosts may provide a last-resort fallback such as `Unable to render widget.` for
malformed callers, but model-authored `ui.render` events must include
`fallback.text`.

V1 `ui.render` does not accept a model-authored widget id. Runtime owns durable
activity ids. If widgets later support updates, add an explicit update contract
such as `replaceActivityId` instead of making create events carry optional ids.

V1 does not support widget updates or replacement. Every render creates a new
durable widget activity row.

## Security and design

* Validate every prop object before it reaches React components.
* Render only known component ids.
* Never execute model-provided JavaScript.
* Never render model-provided HTML, JSX, CSS, class names, bklit primitives, or
  arbitrary component trees.
* Unknown components and invalid props render fallback text plus a visible widget
  error state.
* Unknown components are stored as `widget` activity when the render envelope is
  valid. The transcript shows fallback and error state instead of dropping
  timeline evidence.
* Component styling comes from Tavern tokens and widget code.
* Actions are backend-controlled. Model-provided callbacks are not supported.
* Widget renderers render validated payload only. They do not fetch data, call
  tRPC, read files, query Runtime, or load domain data from props.
* V1 accessibility is minimal: renderers expose the chart title as an accessible
  label and invalid widgets expose visible fallback/error text. Copy/export and
  full data-table alternatives are out of scope.
* Chart hover behavior may come from the app-owned bklit component, but
  interaction is not part of the Widget contract. No clicks, drilldowns, actions,
  or model callbacks in v1.
* Client render failures do not report back to the active agent turn. Tool input
  validation can fail before activity is recorded; Website render fallback is
  UI-only.
* A successful widget render does not require a final assistant message. Agent
  instructions can encourage a short interpretation when useful.

ChatKit and AG-UI are useful reference points for structured widgets, ordered
chat-stream UI, fallback/update semantics, and backend-owned actions. They are
not Tavern dependencies because Tavern already owns Hermes integration, Runtime
projection, and the App renderer.

## Chart widget

The first widget family is Charts. It registers three widget components:

```text
tavern.render_bar_chart
tavern.render_line_chart
tavern.render_composed_chart
```

The agent-facing Widget tools for these components are:

```text
render_bar_chart
render_line_chart
render_composed_chart
```

Each widget component owns its own props schema. Chart components can share the
Charts folder without sharing identical value rules.

The stored widget payload is intentionally small:

```jsonc
{
  "component": "tavern.render_bar_chart",
  "target": "chat.inline",
  "props": {
    "title": "Quarterly Revenue",
    "xKey": "quarter",
    "series": [{ "key": "revenue", "label": "Revenue" }],
    "data": [
      { "quarter": "Q1", "revenue": 12000 },
      { "quarter": "Q2", "revenue": 15500 }
    ]
  },
  "fallback": {
    "text": "Quarterly Revenue"
  }
}
```

Tavern maps those props to bklit chart components. The assistant does not
choose bklit primitives, margins, colors, CSS, or layout.

The agent-facing bar and line chart tool input is simpler than the stored props:

```jsonc
{
  "title": "Quarterly Revenue",
  "data": [
    { "quarter": "Q1", "revenue": 12000 },
    { "quarter": "Q2", "revenue": 15500 }
  ],
  "x": "quarter",
  "y": "revenue",
  "unit": "USD"
}
```

Source APIs may return this chart-ready shape as neutral data. They should not
include a Tavern schema id, widget component id, tool name, or chart type. The
agent chooses the appropriate render tool for the user's question and data shape.

The bar chart supports up to 50 rows and up to 4 series. X values are strings or
numbers. Stored series values are finite nonnegative numbers. The tool accepts
one `y` key or up to four `y` keys and normalizes numeric strings before
storage.

The trend chart supports up to 50 rows and up to 4 series. X values are strings
or numbers. Stored series values are finite numbers, including negative values.
The tool accepts one `y` key or up to four `y` keys and normalizes numeric
strings before storage.

The composed chart supports up to 50 rows and up to 4 total series across
`barSeries` and `lineSeries`. X values are strings or numbers. Stored bar values
are finite nonnegative numbers, and stored line values are finite numbers. The
tool accepts one `barY` key or array and one `lineY` key or array, normalizes
numeric strings before storage, stores optional `barUnit` and `lineUnit`, and
stores separate `barSeries` and `lineSeries` so the App can render Bklit
`SeriesBar` and `Line` layers inside one `ComposedChart` with separate y-axes.

## Calendar widgets

The Calendar family registers two widget components:

```text
tavern.render_calendar_day
tavern.render_calendar_event
```

The agent-facing Widget tools are:

```text
render_calendar_day
render_calendar_event
```

The calendar event widget renders one prepared calendar event in chat. It does
not read the user's calendar, create events, update events, or ask for calendar
permissions.

The tool input is shaped for direct Google Calendar translation:

```jsonc
{
  "summary": "Q1 roadmap review",
  "start": {
    "dateTime": "2026-06-20T13:00:00-04:00",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2026-06-20T14:00:00-04:00",
    "timeZone": "America/New_York"
  },
  "location": "Design room",
  "calendar": "Product",
  "description": "Review roadmap priorities and launch risks."
}
```

For all-day events, use Google Calendar's `start.date` and optional exclusive
`end.date`. The current widget is single-day: an all-day `end.date` must be the
next calendar date, and timed events must start and end on the same display day.
Runtime normalizes accepted tool input into the stored widget payload.

The stored widget payload is intentionally small:

```jsonc
{
  "component": "tavern.render_calendar_event",
  "target": "chat.inline",
  "props": {
    "title": "Q1 roadmap review",
    "date": "2026-06-20",
    "startTime": "13:00",
    "endTime": "14:00",
    "timezone": "America/New_York",
    "location": "Design room",
    "calendar": "Product",
    "notes": "Review roadmap priorities and launch risks."
  },
  "fallback": {
    "text": "Q1 roadmap review"
  }
}
```

Stored dates use `YYYY-MM-DD`. Timed events use a same-day `HH:mm` start and end
time, with `endTime` later than `startTime`. All-day events set `allDay: true`
and omit times. Optional `calendar`, `timezone`, `location`, and `notes` are
display text only.

The calendar day widget renders one prepared calendar day plus up to 12
same-day events in chat. It does not read the user's calendar, create events,
update events, or ask for calendar permissions.

The tool input is shaped for a Google Calendar events list that has already
been fetched or prepared:

```jsonc
{
  "date": "2026-06-20",
  "timezone": "America/New_York",
  "title": "Saturday schedule",
  "events": [
    {
      "summary": "Lunch",
      "start": {
        "dateTime": "2026-06-20T12:00:00-04:00",
        "timeZone": "America/New_York"
      },
      "end": {
        "dateTime": "2026-06-20T12:45:00-04:00",
        "timeZone": "America/New_York"
      }
    },
    {
      "summary": "Q1 roadmap review",
      "start": {
        "dateTime": "2026-06-20T13:00:00-04:00",
        "timeZone": "America/New_York"
      },
      "end": {
        "dateTime": "2026-06-20T14:00:00-04:00",
        "timeZone": "America/New_York"
      },
      "calendar": "Product"
    }
  ]
}
```

Runtime normalizes accepted tool input into the stored day payload:

```jsonc
{
  "component": "tavern.render_calendar_day",
  "target": "chat.inline",
  "props": {
    "date": "2026-06-20",
    "timezone": "America/New_York",
    "title": "Saturday schedule",
    "events": [
      {
        "title": "Lunch",
        "startTime": "12:00",
        "endTime": "12:45",
        "timezone": "America/New_York"
      },
      {
        "title": "Q1 roadmap review",
        "startTime": "13:00",
        "endTime": "14:00",
        "timezone": "America/New_York",
        "calendar": "Product"
      }
    ]
  },
  "fallback": {
    "text": "Saturday schedule"
  }
}
```

Day events use the same single-day event rules as `render_calendar_event`.
Events must start on the day `date`. Runtime stores them in display order:
all-day events first, then timed events by `startTime`.

## What is intentionally missing

* Generic component tree DSL.
* Arbitrary HTML, JSX, CSS, or scripts.
* Approve/deny flows.
* Ads, metrics cards, or domain-specific widgets.
* Model-owned actions or callbacks.
* Sidebar rendering beyond the typed target contract.
