/**
 * Seeded design-guidance skill for chart visuals. Loaded on demand at
 * generation time — the taste layer for ```visual fences, derived from
 * DESIGN.md and the app theme tokens. Keep it a skill, not prompt budget.
 *
 * The CDN pin below must match the CSP in the app's visual renderer
 * (apps/website/src/widgets/visual.tsx); update both together.
 */

export const visualsChartsSkillId = 'visuals-charts';

export const defaultVisualsChartsSkill = `---
name: visuals-charts
description: >
  Design rules for drawing charts and data graphics in a \`\`\`visual fence:
  Tavern's palette and typography tokens, chart chrome discipline, streaming
  order, and the sandbox rules. Load before drawing any chart, sparkline,
  gauge, or stat visual.
---

# Chart visuals

Managed by Tavern. Do not edit this skill directory; Tavern refreshes it on
startup.

A \`\`\`visual fence body is plain HTML/SVG rendered in a sandboxed frame that
inherits Tavern's theme as CSS variables. Draw with the tokens below and the
chart reads as native Tavern UI in both light and dark mode.

## Environment

- Opaque-origin sandbox. No network: fetch/XHR are blocked, remote images and
  fonts are blocked. Embed all data inline at generation time.
- One external library is allowed, pinned:
  \`<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>\`.
  Any other URL is blocked by CSP.
- The body already has 16px padding, the app font, 14px text, and a card
  background behind a transparent body. Content width is about 700px.
- Height is measured automatically; never use fixed or absolute positioning
  for layout, and never set a fixed height on the page itself.

## Tokens (never hardcode surface or text colors)

- Text: \`var(--foreground)\` body, \`var(--muted-foreground)\` secondary.
- Surfaces: \`var(--card)\`, \`var(--surface-2)\` to \`var(--surface-4)\` for
  nested panels. Borders: 1px \`var(--border)\`, stronger \`var(--border-strong)\`.
- Series palette, in order: \`var(--chart-1)\` through \`var(--chart-5)\`.
  Assign roles once and keep them stable: first series gets --chart-1, the
  comparison gets --chart-2, and so on. A single-metric chart uses --chart-1.
- Status is semantic only: \`var(--success)\`, \`var(--warning)\`, \`var(--error)\`,
  \`var(--info)\` mean good/caution/bad/informational — never decoration.
- Brand emphasis: \`var(--brand)\` sparingly, one element at most.
- Radii: \`var(--radius-md)\` controls, \`var(--radius-lg)\` panels.

## Chart chrome

- Two font weights only: 400 body, 600 for the title and key numbers.
- Sentence case everywhere — titles, axis labels, legends. Never uppercase.
- Text never wears the series color: labels, values, and legend text are
  \`var(--foreground)\` or \`var(--muted-foreground)\`; only marks (bars, lines,
  dots, swatches) carry --chart-N.
- Gridlines: horizontal only, 1px, \`color-mix(in srgb, var(--border-strong) 58%, transparent)\`
  or \`var(--chart-grid)\`. No vertical gridlines, no axis boxes.
- Axis labels and ticks: \`var(--chart-label)\` or --muted-foreground, 12px.
- Legend: small swatch (10px, radius 2px) + muted text, above or below the
  plot. Skip it for a single series.
- No gradients, no shadows, no 3D, no decorative backgrounds. Flat fills.
- Numbers: tabular, compact units (1.2k, $4.5M). Lead with the answer — a
  headline number or one-line takeaway above the chart beats a caption below.

## Prefer inline SVG; Chart.js only when it earns it

Simple bars, lines, sparklines, donuts: draw inline SVG. It is crisp, needs
no script, and streams progressively. Use Chart.js only for hover tooltips,
many series, or scales that are real work by hand — and expect it to render
only once the script loads at the end.

## Streaming order

The document renders top-to-bottom while you write it, so:

1. Title and headline first, plain HTML.
2. Then the chart markup, styled inline or with a <style> block placed
   before the content it styles.
3. Scripts last, always at the end of the body; they run once the document
   completes. Never reference elements below a script.

## Skeleton

\`\`\`
<h2 style="margin:0 0 4px;font-size:15px;font-weight:600">Weekly sales</h2>
<p style="margin:0 0 12px;color:var(--muted-foreground)">Up 18% over last week.</p>
<svg viewBox="0 0 640 220" width="100%" role="img" aria-label="Weekly sales bar chart">
  <line x1="0" y1="180" x2="640" y2="180" stroke="var(--chart-grid)" />
  <rect x="20" y="60" width="48" height="120" rx="3" fill="var(--chart-1)" />
  <text x="44" y="200" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">Mon</text>
</svg>
\`\`\`
`;
