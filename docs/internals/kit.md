---
summary: Tavern component kit reference for the shared presentational library behind widgets, dashboards, and sandboxed agent pages.
read_when:
  - adding or changing shared inline-UI components such as frames, charts, tables, or calendar cards
  - building a widget renderer, dashboard tile, or sandboxed agent page on kit components
  - deciding whether presentation code belongs in the kit or in a widget wrapper
---

# Component Kit

`apps/website/src/kit/` is the Tavern component kit: the single presentational
library behind every inline-UI surface. Catalog widget renderers, plugin widget
renderers, the dashboard grid, and sandboxed agent TSX pages all compose these
components. The kit owns the "make it look nice" problem — axes, ticks,
tooltips, chart composition, calendar cards, tables, frames, empty states,
tokens, dark mode, responsive width — solved once, consumed everywhere.

`src/kit/index.ts` is the public entrypoint and the module's contract.

## Rules

- Kit components are props-in/render-out. No data fetching, no tRPC, no hooks
  from `src/hooks`, no app or runtime state. Anything under `src/kit/` must
  stay importable into a standalone sandboxed-iframe bundle.
- Colors come from `src/styles/global.css` tokens only (directly or via
  `chartStyleVars`), so every component is theme-clean in light and dark.
- Kit prop types are kit-local. Widget fence schemas in `@tavern/api` are one
  consumer whose parsed props structurally satisfy kit props; the kit does not
  import the fence contract.
- Deeper primitives stay where they live: the chart engine under
  `src/components/charts/` and COSS UI primitives under `src/components/ui/`
  are implementation dependencies the kit composes, not part of its surface.

## Components

| Export | Role |
| --- | --- |
| `KitFrame` | Titled card frame for inline blocks: optional header title + action, elevated rounded body, `compact`/`full` width. |
| `KitBarChart` | Framed bar chart with grid, axes, tooltip, and hoverable legend. Props: `title`, `data`, `series`, `xKey`, `unit?`. |
| `KitLineChart` | Framed area/line chart; same props as `KitBarChart`, dual y-axes when two series. |
| `KitComposedChart` | Framed bars-plus-line chart. Props: `title`, `data`, `barSeries`, `lineSeries`, `xKey`, `unit?`, `barUnit?`, `lineUnit?`. |
| `KitComposedChartBody` | Unframed composed chart body with layout knobs (`chartMargin`, `xAxisTickCount`, `showLegend`, `onActiveIndexChange`, ...) for hosts that own their frame, like the MerchBase widget. |
| `KitChartLegend` | Hover-linked legend row used by the kit charts; exported for custom chart compositions. |
| `KitChartStatus` | Loading/error/empty text panel sized to sit in place of a chart body. |
| `KitTable` | Bordered data table with per-column `align` and Yes/No boolean formatting. Props: `columns`, `rows`. |
| `KitCalendarEvent` | Single-event card with a date tile and time range label. |
| `KitCalendarDay` | Day agenda card: date tile, timezone label, event cards, empty state. |
| `KitDateRangeSelector` | Popover date-range picker with presets (7d/14d/30d/month). |

Also exported: `chartStyleVars` (the chart token mapping), chart prop types
(`KitChartSeries`, `KitChartDatum`, ...), and ISO date helpers
(`formatIsoDate`, `parseIsoDate`, `shiftIsoDate`, ...).

## Consumers

Widget renderers under `src/widgets/` are thin wrappers: parse or receive fence
props, map them onto kit components, and keep widget-only concerns (fallback
rows, workspace file queries, plugin queries) outside the kit. See
[widgets.md](widgets.md) for the fence contract and
[frontend.md](frontend.md) for folder ownership.
