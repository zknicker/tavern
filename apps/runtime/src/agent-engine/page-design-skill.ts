/**
 * Seeded design-guidance skill for full self-contained HTML pages: artifact
 * pane pages and html-preview workspace files. Owns the page-level theme
 * token contract once — the always-on prompt entries keep only capability
 * discovery and the invocation contract.
 */

export const pageDesignSkillId = 'page-design';

export const defaultPageDesignSkill = `---
name: page-design
description: >
  Design rules for authoring full self-contained HTML pages: artifact pane
  pages and workspace html-preview files. Tavern's theme token contract,
  layout and typography discipline, and self-containment rules. Load before
  writing any standalone HTML page.
---

# Page design

Managed by Tavern. Do not edit this skill directory; Tavern refreshes it on
startup.

Pages you author render with Tavern's theme tokens injected as CSS variables,
so a page styled with the tokens below looks native in both light and dark
mode. Pages must be fully self-contained: inline CSS/JS only, no external or
sibling asset references, no network requests.

## Token contract (never hardcode surface or text colors)

- Surfaces: \`var(--background)\` page ground, \`var(--card)\` panels,
  \`var(--surface-2)\` to \`var(--surface-4)\` for nested elevation.
- Text: \`var(--foreground)\` body, \`var(--muted-foreground)\` secondary.
- Borders: 1px \`var(--border)\`; stronger separation \`var(--border-strong)\`.
- Controls and fills: \`var(--muted)\`, \`var(--secondary)\`, \`var(--accent)\`.
- Emphasis: \`var(--brand)\` sparingly; readable tinted text via
  \`var(--brand-muted)\` + \`var(--brand-muted-foreground)\`.
- Status (semantic only): \`var(--success)\`, \`var(--warning)\`,
  \`var(--error)\`, \`var(--info)\`, each with \`-foreground\` and \`-bg\`
  variants for chips and callouts.
- Radii: \`var(--radius-md)\` controls, \`var(--radius-lg)\` panels,
  \`var(--radius-xl)\` large cards. Fonts: \`var(--font-sans)\` UI,
  \`var(--font-mono)\` code and compact metadata; base size
  \`var(--app-ui-font-size)\` (14px).
- Charts or diagrams inside a page follow the visuals-charts and
  visuals-diagrams skills (series palette \`var(--chart-1)\` .. \`var(--chart-5)\`).

## Layout and typography

- Quiet and operational: dense scannable sections, hairline borders, flat
  fills. No gradients, decorative orbs, heavy shadows, or 3D.
- Two font weights: 400 body, 600 headings and key values. Sentence case
  everywhere, including table headers; never uppercase.
- 14px body; step up only for section titles. Compact mono for timestamps,
  ids, and metadata.
- Tables: horizontal dividers only, sentence-case headers, right-align
  numbers.
- Constrain content width (~48rem) for readable prose; full-width only for
  tables and dashboards.

## Self-containment

- One file: inline <style> and <script>, data: URIs for small images.
- No external fonts, scripts, stylesheets, or fetches; assume the page is
  rendered offline from a snapshot.
- Use semantic HTML with a sensible heading outline; the first heading or
  <title> names the page.
- html-preview specifics: write the file under \`workbench/\`; the widget's
  optional \`height\` prop clamps 120-1200px (default 480).
`;
