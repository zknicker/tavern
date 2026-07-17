---
summary: Agent TSX artifacts — the artifact fence authoring contract, the kit-for-agents reference, the pane renderer, and the page-runtime bundle build.
read_when:
  - changing the artifact fence, its transcript card, the .tsx pane renderer, or the page-runtime bundle build
  - changing what agent pages can import from @tavern/kit
  - writing or reviewing agent guidance for authoring TSX artifacts
---

# Agent TSX Artifacts

Agents build durable artifacts as single-file TSX pages: the chat transcript
shows a compact card, and opening it renders the compiled page in the artifact
pane inside the same opaque-origin iframe boundary as `html-preview`. The
agent authors one `.tsx` in its workspace and references it with a bare
`artifact` fence; the pane compiles it with React plus the Tavern component
kit, so artifacts get within-page interactivity and the native Tavern look
while big surfaces stay out of the chat column.

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
- Reference it with a bare `artifact` fence: `{"path": "workbench/...",
  "title"?: string}`. The chat shows a compact card; the page renders in the
  artifact pane, which owns sizing (no height prop). Rendering is live file
  state — later edits or deletion change what the card opens.

## Security boundary

Identical to `html-preview`: the confined Runtime workspace read (realpath
confinement, secret-file blocks, complete reads only — here the 512 KiB text
window) fetches the file, and the document renders via `srcDoc` in a sandboxed
iframe with scripts allowed and never `allow-same-origin`. TSX changes the
authoring language, not the sandbox; moving the render into the artifact pane
changes the venue, not the boundary. Compilation itself happens inside the
iframe, so hostile source never executes — or even parses — in the app origin.
The import allowlist is mechanical: the compiled module's `require` resolves
only the two vendored namespaces and throws on anything else before the page
mounts, so a failing page renders the error plus its fenced source, never a
partial page.

## Card and pane flow

The `artifact` fence funnels into the widget machinery (component id
`tavern.widget.artifact`; see [widgets.md](widgets.md)). The transcript
renderer (`apps/website/src/widgets/artifact-card.tsx`) draws the compact card
— title, kind line, open affordance — and performs no workspace read.
Clicking calls the artifact-panel open path with a `workspaceFile` target, the
same merge-or-focus flow `tavern://workspace` links and the agent `pane_open`
tool use. In the pane, the workspace file preview
(`apps/website/src/features/chats/chat-artifact-page-preview.tsx`) renders
`.tsx` files through the page runtime, sibling to the existing image, HTML,
and code renderers.

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

The pane renderer embeds both strings plus the file content into the srcDoc
and stamps the app's resolved scheme onto the iframe document (`class="dark"`
+ `data-theme`), so pages follow the app theme. The compile/evaluate pipeline
(`page-runtime/compile.ts`) is shared between the iframe entry and the website
tests, which exercise the real compile-and-render path against the actual kit
exports.
