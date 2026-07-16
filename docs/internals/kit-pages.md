---
summary: Sandboxed agent TSX pages — the widget:page authoring contract, the kit-for-agents reference, and the page-runtime bundle build.
read_when:
  - changing the page widget, its in-iframe compiler, or the page-runtime bundle build
  - changing what agent pages can import from @tavern/kit
  - writing or reviewing agent guidance for authoring TSX pages
---

# Agent TSX Pages

`widget:page` renders an agent-authored single-file React page inside the
same opaque-origin iframe boundary as `html-preview`. The agent writes one
`.tsx` in its workspace; the app compiles it inside the sandboxed iframe and
renders it with React plus the Tavern component kit, so agent pages get
within-page interactivity and the native Tavern look while the security
boundary stays exactly where `html-preview` put it.

## Authoring contract (the kit-for-agents reference)

This is the contract agent guidance teaches; the always-on prompt entry is a
compressed form of it.

- Write one self-contained `.tsx` file under `workbench/`. No sibling files,
  no multi-file projects, no external assets or network access.
- The file must default-export a React component.
- Exactly two import sources exist: `react` and `@tavern/kit`. Any other
  import — URL imports above all — fails the page with a visible error.
  Local helper components and functions inside the same file are fine.
- Compose the kit rather than rebuilding primitives. From `@tavern/kit`:
  - `Card` — titled framed surface (`size="compact" | "full"`, `title`,
    `titleAction`); frame charts and tables with it.
  - `BarChart`, `LineChart` — `{ data, series, xKey, unit? }`; unframed,
    compose inside `Card`.
  - `ComposedChart` — bars plus a line: `{ data, barSeries, lineSeries,
    xKey, barUnit?, lineUnit? }`.
  - `ChartLegend`, `ChartStatus` — legend row and loading/error/empty panel
    for custom chart compositions.
  - `Table` — `{ columns: [{ key, label, align? }], rows }`.
  - `CalendarEvent`, `CalendarDay` — event card and day agenda card.
  - `DateRangePicker` — popover range picker with presets.
  - ISO date helpers: `formatIsoDate`, `parseIsoDate`, `shiftIsoDate`, ...
- Tavern tokens are available as CSS variables (`--foreground`,
  `--muted-foreground`, `--surface-2`, `--border`, `--error-bg`, ...), and
  Tailwind utility classes used by the kit graph are compiled in. Prefer kit
  components; reach for tokens only for small glue styling.
- Render it with a `widget:page` fence: `{"path": "workbench/...", "height"?:
  120-1200, "title"?: string}`. Rendering is live file state — later edits or
  deletion change what historical chats display.

## Security boundary

Identical to `html-preview`: the confined Runtime workspace read (realpath
confinement, secret-file blocks, complete reads only — here the 512 KiB text
window) fetches the file, and the document renders via `srcDoc` in a sandboxed
iframe with scripts allowed and never `allow-same-origin`. TSX changes the
authoring language, not the sandbox. Compilation itself happens inside the
iframe, so hostile source never executes — or even parses — in the app origin.
The import allowlist is mechanical: the compiled module's `require` resolves
only the two vendored namespaces and throws on anything else before the page
mounts, so a failing page renders the error plus its fenced source, never a
partial page.

## Page runtime bundle

`apps/website/scripts/build-page-runtime.ts` (run via
`bun run sync:page-runtime`; `dev`, `build`, `test`, and `typecheck` chain it)
builds the runtime from the kit sources — one source of truth, never a fork:

- esbuild bundles `src/widgets/page-runtime/entry.tsx` — React, ReactDOM, the
  full kit graph (including `Elevated`, `cn`, and the chart engine), and the
  sucrase TSX compiler — into a single IIFE exposing
  `window.tavernPageRuntime.render(source)`.
- Tailwind v4 compiles `src/styles/page-runtime.css`: `tokens.css` (the same
  token file `global.css` imports — dark and light blocks, theme mapping) plus
  utilities scanned from the kit dependency graph only. Geist faces ride along
  as data: URLs because an opaque-origin srcDoc cannot fetch app assets.
- Output lands in `src/widgets/page-runtime/generated/page-runtime.ts`
  (gitignored) as two exported strings, so vite, tsc, and bun test all load it
  with no loaders or virtual modules.

The widget renderer (`src/widgets/page.tsx`) embeds both strings plus the file
content into the srcDoc and stamps the app's resolved scheme onto the iframe
document (`class="dark"` + `data-theme`), so pages follow the app theme. The
compile/evaluate pipeline (`page-runtime/compile.ts`) is shared between the
iframe entry and the website tests, which exercise the real
compile-and-render path against the actual kit exports.
