---
summary: Tavern component kit reference for the shared presentational library behind widgets, dashboards, and sandboxed agent pages.
read_when:
  - adding or changing shared inline-UI components such as cards, charts, tables, or calendar cards
  - building a widget renderer, dashboard tile, or sandboxed agent page on kit components
  - deciding whether presentation code belongs in the kit or in a widget wrapper
---

# Component Kit

`apps/website/src/kit/` is the Tavern component kit: the single presentational
library behind every inline-UI surface. Catalog widget renderers, plugin widget
renderers, the dashboard grid, and sandboxed agent TSX pages all compose these
components. The kit owns the "make it look nice" problem — axes, ticks,
tooltips, chart composition, calendar cards, tables, cards, empty states,
tokens, dark mode, responsive width — solved once, consumed everywhere.

`src/kit/index.ts` is the public entrypoint and the module's contract. The
vocabulary is bare nouns that read as a small design system and can be guessed
cold by an author who has only seen a short reference:

```tsx
<Card size="full" title="Quarterly Revenue">
    <BarChart data={points} series={[{ key: 'revenue', label: 'Revenue' }]} xKey="quarter" />
</Card>
```

## Rules

- Kit components are props-in/render-out. No data fetching, no tRPC, no hooks
  from `src/hooks`, no app or runtime state. Anything under `src/kit/` must
  stay importable into a standalone sandboxed-iframe bundle.
- Colors come from `src/styles/global.css` tokens only (directly or via
  `chartStyleVars`, which every kit chart scopes onto its own root), so every
  component is theme-clean in light and dark.
- No `Widget` prefix in the kit. "Widget" is the fence/catalog layer above the
  kit; the thin `Widget*` wrappers under `src/widgets/` keep that prefix so the
  layering is self-documenting.
- Kit prop types are kit-local. Widget fence schemas in `@tavern/api` are one
  consumer whose parsed props structurally satisfy kit props; the kit does not
  import the fence contract.
- Deeper primitives stay where they live: the chart engine under
  `src/components/charts/` and COSS UI primitives under `src/components/ui/`
  are implementation dependencies the kit composes, not part of its surface.

## Components

| Export | Role |
| --- | --- |
| `Card` | Titled framed surface: optional header title + action, elevated rounded body, `compact`/`full` width. |
| `BarChart` | Bar chart with grid, axes, tooltip, and hoverable legend. Props: `data`, `series`, `xKey`, `unit?`. Unframed — compose inside `Card`. |
| `LineChart` | Area/line chart; same props as `BarChart`, dual y-axes when two series. |
| `ComposedChart` | Bars-plus-line chart. Props: `data`, `barSeries`, `lineSeries`, `xKey`, `unit?`, `barUnit?`, `lineUnit?`, plus layout knobs (`chartMargin`, `xAxisTickCount`, `showLegend`, `onActiveIndexChange`, ...). |
| `ChartLegend` | Hover-linked legend row used by the kit charts; exported for custom chart compositions. |
| `ChartStatus` | Loading/error/empty text panel sized to sit in place of a chart body. |
| `Table` | Bordered data table with per-column `align` and Yes/No boolean formatting. Props: `columns`, `rows`. |
| `CalendarEvent` | Single-event card with a date tile and time range label. |
| `CalendarDay` | Day agenda card: date tile, timezone label, event cards, empty state. |
| `DateRangePicker` | Popover date-range picker with presets (7d/14d/30d/month). |

Also exported: `chartStyleVars` (the chart token mapping), chart prop types
(`ChartSeries`, `ChartDatum`, ...), and ISO date helpers (`formatIsoDate`,
`parseIsoDate`, `shiftIsoDate`, ...).

Layout components (`Stack`, `Grid`, `Row`) and stat/empty containers are
reserved vocabulary for the dashboard grid and sandboxed agent pages; add them
with those features, not speculatively.

## Consumers

Widget renderers under `src/widgets/` are thin `Widget*` wrappers: map fence
props onto kit components (`WidgetBarChart` = fence props → `Card` +
`BarChart`), and keep widget-only concerns (fallback rows, workspace file
queries, plugin queries) outside the kit. See [widgets.md](widgets.md) for the
fence contract and [frontend.md](frontend.md) for folder ownership.

Sandboxed agent TSX pages consume the kit through the page-runtime bundle:
`scripts/build-page-runtime.ts` compiles the kit sources (plus the tokens in
`src/styles/tokens.css`) into the self-contained script and stylesheet the
artifact-pane page iframe runs. That build is why kit components must stay
props-in/render-out with token-only colors. See [kit-pages.md](kit-pages.md).
