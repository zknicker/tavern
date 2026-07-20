---
summary: Decision to carry all rendering and design guidance in one seeded visuals skill, leaving the system prompt a three-line pointer.
read_when:
  - changing the visuals skill, the widget catalog teaching, or fence guidance
  - changing the agent system prompt's Visuals section or prompt budgets
  - tuning generated-visual quality or running the design battery
---

# ADR 0012: Design Guidance Is Skill-Carried

## Status

Accepted (PRD-86). Builds on [ADR 0010](0010-widgets-use-tagged-fences.md);
fence grammar and rendering contracts are unchanged.

## Context

After PRD-80/81, the composed system prompt carried a Visuals section, a
Widgets section with per-widget prop signatures, and routing to three seeded
design skills (visuals-charts, visuals-diagrams, page-design). The always-on
cost was ~4.3k characters per turn, the guidance was split across four
places, and first-generation output quality was mediocre — the taste layer
needed room to grow far beyond what prompt budget allows.

Kimi ships the strongest inline generative UI we have seen with the inverse
shape: the system prompt spends ~3 lines (a tool line, a skill line, one
runtime sentence) and a single rich skill carries when-to-render, the
runtime contract, and the full design system as references. Frontier-class
executor models follow a hard "read the skill before rendering" pointer
reliably, so duplicating guidance into the prompt buys nothing.

## Decision

One seeded `visuals` skill owns everything agents render — inline visuals,
widget fences, and artifact pages: when to render, fence grammar, the core
widget catalog signatures, and the design system
(`references/design-system.md`, `references/icons.md`, curated icon assets).

The system prompt keeps only a three-line pointer: the surfaces exist, the
visuals skill is a mandatory read before emitting any fence, and raw markup
never appears in plain reply text. Plugin widgets are taught by their
Plugin's skill (manifest `skillGuidance`), which already gates on the plugin
grant.

The prompt contract suite guards both sides: prompt requirements for the
pointer, skill-side requirements (`VISUALS_SKILL_REQUIREMENTS`) for every
capability that moved. Skill sources are real markdown files under
`apps/runtime/src/agent-engine/visuals-skill/`, inlined at build time, so
the design-tuning loop (`bun run eval:design`) edits markdown and reseeds.

## Consequences

- The per-turn prompt drops ~4.3k characters; design guidance gains
  effectively unlimited room to grow without prompt-budget fights.
- An agent that skips the skill read has no catalog signatures in context —
  acceptable with current executor models, and the battery would surface a
  model that does not comply.
- Widget availability is no longer advertised per agent in the prompt;
  plugin-widget guidance rides the plugin skill grant instead.
- The retired skill ids (visuals-charts, visuals-diagrams, page-design) are
  removed without migration code; existing installs clean up stale seeded
  directories and agent skill assignments by direct database edit at
  release time.
