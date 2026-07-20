/**
 * Seeded design-guidance skill for diagram visuals. Loaded on demand at
 * generation time — flowcharts, sequences, architecture and relationship
 * diagrams drawn as plain HTML/SVG in the ```visual sandbox.
 */

export const visualsDiagramsSkillId = 'visuals-diagrams';

export const defaultVisualsDiagramsSkill = `---
name: visuals-diagrams
description: >
  Design rules for drawing diagrams in a \`\`\`visual fence: flowcharts,
  sequences, timelines, architecture boxes, and relationship maps as plain
  HTML/SVG with Grotto's tokens. Load before drawing any diagram or
  structural visual.
---

# Diagram visuals

Managed by Grotto. Do not edit this skill directory; Grotto refreshes it on
startup.

A \`\`\`visual fence body is plain HTML/SVG rendered in a sandboxed frame that
inherits Grotto's theme as CSS variables. Diagrams are boxes, labels, and
connectors — no diagram library, no mermaid; the sandbox allows no external
scripts except the pinned Chart.js, which diagrams never need.

## Environment

- Opaque-origin sandbox, no network. Everything must be inline.
- The body has 16px padding, the app font, 14px text, transparent background
  over a card surface. Content width is about 700px.
- Height is measured automatically; let the document flow. No \`position:
  fixed\`, and avoid absolute positioning for the overall layout — use flex
  or grid for structure, inline SVG for connectors.

## Tokens (never hardcode surface or text colors)

- Nodes: fill \`var(--surface-3)\`, border 1px \`var(--border-strong)\`, radius
  \`var(--radius-lg)\`, text \`var(--foreground)\`.
- Secondary text and edge labels: \`var(--muted-foreground)\`, 12px.
- Connectors: 1.5px \`var(--border-strong)\` strokes; arrowheads as small SVG
  markers in the same color. Emphasized paths may use \`var(--chart-1)\`.
- Highlight at most one node with \`var(--brand-muted)\` fill and
  \`var(--brand-muted-foreground)\` text, or a 1px \`var(--brand)\` border.
- Status states are semantic only: \`var(--success)\`, \`var(--warning)\`,
  \`var(--error)\` for healthy/degraded/failed — never decoration.

## Composition

- Two font weights only: 400 labels, 600 for node titles and the diagram
  heading. Sentence case; never uppercase.
- Hairline borders, flat fills. No gradients, shadows, or 3D.
- One idea per diagram. Prefer 4-9 nodes; past that, group into labeled
  clusters (a bordered container with a 12px muted caption).
- Keep flow direction consistent: left-to-right for pipelines, top-to-bottom
  for hierarchies. Align nodes to a grid; even gaps (12-24px).
- Edge labels sit beside the line in muted 12px text, not on colored chips.
- Lead with a one-line takeaway above the diagram when the structure alone
  does not say it.

## Patterns

- Pipeline: a flex row of nodes with SVG arrows between; wrap long pipelines
  into rows.
- Hierarchy/tree: nested flex columns; connectors as a thin SVG layer sized
  to the container when needed, or simple indentation with left borders.
- Sequence: two or more columns with lifelines as 1px vertical borders and
  labeled horizontal arrows.
- Timeline: a vertical left border with dot markers and dated entries.

## Streaming order

The document renders top-to-bottom while you write it: heading first, then
nodes in reading order, connectors with (or after) the content they join.
Inline styles or a <style> block above the content it styles, scripts never.

## Skeleton

\`\`\`
<h2 style="margin:0 0 12px;font-size:15px;font-weight:600">Deploy pipeline</h2>
<div style="display:flex;align-items:center;gap:8px">
  <div style="padding:10px 14px;background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--radius-lg)">
    <div style="font-weight:600">Build</div>
    <div style="font-size:12px;color:var(--muted-foreground)">2m 10s</div>
  </div>
  <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
    <path d="M0 6h22m-5-5 5 5-5 5" fill="none" stroke="var(--border-strong)" stroke-width="1.5"/>
  </svg>
  <div style="padding:10px 14px;background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--radius-lg)">
    <div style="font-weight:600">Test</div>
    <div style="font-size:12px;color:var(--success-foreground)">Passing</div>
  </div>
</div>
\`\`\`
`;
