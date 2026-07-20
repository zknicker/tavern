---
name: visuals
description: >
  Tavern design system for everything you render: inline visuals, app-native
  widgets, and artifact pages. Read this BEFORE emitting any visual, widget,
  or artifact fence. Defines when to render, the fence contracts, and the
  widget catalog; the full visual style lives in references/design-system.md.
---

# Visuals

Managed by Tavern. Do not edit this skill directory; Tavern refreshes it on
startup.

You render three kinds of visual output in chat:

- A **visual** — bespoke inline HTML/SVG in a ```` ```visual ```` fence:
  charts, diagrams, dashboards, calculators, comparisons, timelines, state
  machines, small simulations.
- A **widget** — an app-native typed component in a ```` ```widget:<name> ````
  fence holding one JSON props object: tables, standard charts, calendar
  cards.
- An **artifact** — a durable self-contained HTML page carded in chat and
  opened in the artifact pane, for anything the user will keep or iterate on.

## When to render

- Render when the answer has spatial, sequential, systemic, comparative,
  numeric, or interactive structure. Seeing structure must help the user
  understand, compare, inspect, or act better than prose alone.
- The user does not need to say "show", "visualize", "chart", or "widget" —
  proactive visuals are expected when the structure is there.
- If the user gives a compact visual spec without a verb ("REST vs GraphQL
  table", "checkout state machine", "pricing calculator"), render it instead
  of only describing it.
- Routing: use a **widget** when a catalog widget fits the answer exactly
  (tabular → `widget:table`, plain trend or comparison → the chart widgets,
  calendar-shaped → the calendar widgets). Draw a **visual** when the data
  deserves a bespoke picture no catalog widget covers. Build an **artifact**
  for deliverables — documents, reports, pages the user will keep. When
  unsure, use plain text.
- Do **not** render a visual for: ordinary prose answers, routine
  line-by-line code explanations, file lists or final file deliverables,
  blocking input workflows, destructive or native actions, or large
  long-lived apps.

## Fence contracts

A visual is a fenced block whose language is `visual`; the body is raw
HTML/SVG; optional text after `visual` on the fence line becomes the title:

````
```visual Weekly sales
<h2>Weekly sales</h2>
<svg viewBox="0 0 640 220">...</svg>
```
````

A widget is a fenced block whose language is `widget:<name>`, containing
exactly one complete valid JSON object of props — no comments, no trailing
commas. If unsure the props are valid, reply with text instead:

````
```widget:bar-chart
{"title":"Weekly sales","xKey":"day","series":[{"key":"sold","label":"Sold"}],"data":[{"day":"Mon","sold":4},{"day":"Tue","sold":7}]}
```
````

An artifact is a self-contained `.html` file (inline CSS/JS, no external
assets) written under `workbench/`, then referenced with a bare `artifact`
fence whose props point at it. The chat shows a compact card that opens the
page in the artifact pane.

Rules:

- Tavern strips fences from your visible reply and renders them in place.
- Use `widget:table` instead of Markdown tables.
- Widget fence bodies are pure JSON — never HTML, JSX, CSS, class names, or
  imports. Raw HTML belongs only in a `visual` fence or an artifact file.
- Never output HTML, JSX, CSS, imports, or class names in plain reply text.
- Text goes in your reply, visuals go in the fence. Do not repeat identical
  content in prose and in a fence; prose adds context, never restates.
- After a visual renders, don't narrate it. Say only what the visual cannot.
- Multiple fences in one reply are allowed when the answer has clearly
  separate visual parts; prefer one.

## Widget catalog

`widget:table` — compact rows and columns for tabular data.
`{"columns":[{"key":string,"label":string,"align"?:"left"|"right"}],"rows":[{<key>:string|number|boolean|null}]}`
Shorthand: `columns` as plain label strings with `rows` as cell arrays in
column order. Max 8 columns, 50 rows.

`widget:bar-chart` — bar chart for nonnegative comparable numeric series
(rankings, totals).
`{"title":string,"xKey":string,"series":[{"key":string,"label":string}],"data":[{...}],"unit"?:string}`
Each data row holds the xKey value plus one number per series key. Max 4
series, 50 rows.

`widget:line-chart` — line chart for trend series; values may be negative.
Same props as `widget:bar-chart`.

`widget:composed-chart` — combined bars and lines for related quantities
sharing one x-axis.
`{"title":string,"xKey":string,"barSeries":[...],"lineSeries":[...],"data":[{...}],"barUnit"?:string,"lineUnit"?:string}`
Bar values must be nonnegative; bar and line series keys must not overlap.

`widget:calendar-event` — single event card.
`{"title":string,"date":"YYYY-MM-DD","startTime"?:"HH:mm","endTime"?:"HH:mm","allDay"?:boolean,"location"?:string,"notes"?:string,"calendar"?:string,"timezone"?:string}`
Timed events need both startTime and endTime; all-day events need neither.

`widget:calendar-day` — single-day agenda with zero or more events.
`{"date":"YYYY-MM-DD","events":[<calendar-event props without date>],"title"?:string,"timezone"?:string}`
Max 12 events.

`widget:html-preview` — sandboxed inline preview of a workspace HTML file;
for custom pages no other surface covers.
`{"path":string,"height"?:number,"title"?:string}`
Write the self-contained file under `workbench/` first; path is
workspace-relative; height clamps 120-1200 (default 480).

`widget:artifact` — durable page in the artifact pane (see Fence contracts).
`{"path":string,"title"?:string}`

Plugin-granted widgets (if any) are taught by their Plugin's skill.

## Visual runtime contract

- The `visual` fence body renders in a sandboxed iframe with Tavern's theme
  tokens preloaded as CSS variables. Content width is about 700px; the body
  has 16px padding, the app font, 14px text, a card background. Height is
  measured automatically — let the document flow; no fixed heights, no
  `position: fixed`.
- No network: fetch/XHR, remote images, and fonts are blocked. Embed all
  data inline at generation time. One pinned exception: Chart.js
  (see design-system.md, Charts).
- Allowed: HTML, SVG, CSS, inline JavaScript, native browser APIs. There is
  no host bridge — interactivity works within the iframe over embedded data.
- Never hardcode colors, fonts, or radii — always use `var(--xxx)`.
  Hardcoded values break dark mode and look alien beside the host UI.

## ⚠️ Required: read the design system before you design

**Unless the user has given you very explicit, precise styling instructions
for this specific output, you MUST read
[references/design-system.md](references/design-system.md) before writing
visual, widget-adjacent, or artifact markup.** It carries the full Tavern
visual style — visual rules, typography, component patterns, chart and
diagram construction, page layout, the runtime token map, and the
application checklist. Do not decide an output is too simple, too static,
or too small to need it. Skip it only when the user's instructions already
fix the visual decisions for you.

If the output uses icons, also read
[references/icons.md](references/icons.md): the skill ships a curated icon
library (`assets/icons/`, indexed in `references/icons/manifest.json`) —
pick from the library and inline the SVG instead of drawing your own or
using emoji.
