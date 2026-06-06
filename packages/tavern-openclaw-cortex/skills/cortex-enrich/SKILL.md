---
name: cortex-enrich
description: Enrich notable people, companies, projects, products, and other durable Cortex pages.
allowed-tools:
  - cortex_search
  - cortex_recall
  - cortex_get_page
  - cortex_list_backlinks
  - cortex_edit
  - cortex_capture
---

# Cortex Enrich

Use this skill when a durable person, company, project, product, brand, niche,
production partner, platform, or tool needs a useful Cortex page.

This is adapted from GBrain `enrich`: scale the work to importance, preserve
texture, and update compiled truth without creating low-value stubs.

## Contract

This skill guarantees:

- The entity is checked in Cortex before creating or updating a page.
- Enrichment effort is scaled to the entity's durable value.
- The page has current truth, useful context, relationships, and source notes.
- Contradictions are preserved instead of overwritten silently.
- No page is created for random mentions with no durable relationship signal.

## When To Invoke

Use this skill for:

- "Enrich this", "who is this", "look up this company", or "update this page".
- A source, transcript, or conversation mentions a notable entity.
- An existing Cortex page is thin, stale, contradictory, or missing current context.
- A person/company/project matters to the user's businesses, investing, design,
  programming, automations, workflows, or recurring interests.

Do not enrich incidental names, spam, one-off mentions, or entities with no
substantive connection to the user.

## Enrichment Tiers

Use the lightest tier that creates a useful page:

- Tier 1: key people, companies, active projects, major business context.
  Use Cortex, live sources when available, source pages, backlinks, and careful
  synthesis.
- Tier 2: notable but occasional people, companies, platforms, products, or
  concepts. Use Cortex plus a small number of reliable sources.
- Tier 3: minor but worth tracking. Use Cortex context and the current source;
  avoid broad research.

## Phases

1. Identify the primary entity:
   - Decide whether the durable subject is a person, company, project, product,
     brand, niche, production partner, platform, tool, source, or note.
   - If a better local page type exists, use it. If a new type is clearer,
     use it and let Runtime record the schema addition.
2. Check Cortex first:
   - Use `cortex_search` for exact name, aliases, company, handle, or source title.
   - Use `cortex_recall` when the entity may be known by context.
   - Use `cortex_get_page` if a likely page exists.
   - Use `cortex_list_backlinks` to find related pages and prior mentions.
3. Extract useful signal:
   - For people: role, relationship to the user, beliefs, work, recurring themes,
     motivation, trajectory, and relevant network.
   - For companies/projects/products: current state, what it does, why it matters,
     relationship to the user, competitors, risks, and open questions.
   - For business objects: marketplace, niche, production partner, design,
     listing, campaign, metric, workflow, and source evidence.
4. Decide create vs update:
   - Update an existing page when it represents the same entity.
   - Create only when there is enough durable value to avoid a stub.
   - Merge or archive duplicate pages through `cortex_edit` when clearly needed.
5. Write the page:
   - Use `cortex_edit action: "upsert"` for a complete page update.
   - Put current truth first in `compiledTruth`.
   - Use `body` for durable sections, notes, source synthesis, and open questions.
   - Add timeline entries for dated events and material changes.
   - Add links for durable relationships, not every incidental mention.
6. Report briefly:
   - Say what changed, what sources informed it, and what remains uncertain.

## Page Shape

Prefer concise, useful sections:

- `## State`
- `## Why It Matters`
- `## Relationship To Zach`
- `## What They Believe` or `## What It Does`
- `## Current Work`
- `## Assessment`
- `## Open Questions`
- `## Sources`

Use only sections that fit the subject. Do not add empty boilerplate.

## Source Rules

- Current user messages override older Cortex content.
- User-authored captures outrank agent synthesis.
- Live facts that can change should be checked from a live source when they
  matter.
- If sources conflict, state both claims and preserve the contradiction.

## Anti-Patterns

- Creating a page just because a name appeared once.
- Filling pages with generic bios or product copy.
- Overwriting user-written assessment with external boilerplate.
- Hiding uncertainty or source conflicts.
- Doing Tier 1 research for low-value mentions.
- Creating many entity pages from one source without a durability reason.
