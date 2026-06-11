Vendored from evilcharts (https://evilcharts.com, legions-developer/evilcharts)
via its shadcn registry items: chart, tooltip, legend, dot, evil-brush,
background, line-chart.

Tavern adaptations:

- `@/registry/ui/*` imports rewritten to relative paths.
- `motion/react` rewritten to `framer-motion` (same API, already a dependency).
- `@/lib/utils` rewritten to the app's `lib/utils.ts`.

These files are vendored third-party code: keep them byte-close to upstream and
excluded from repo lint so registry bumps stay diffable. Re-vendor by fetching
`https://evilcharts.com/r/<item>.json` and re-applying the import rewrites.
