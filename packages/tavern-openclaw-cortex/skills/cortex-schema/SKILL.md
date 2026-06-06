---
name: cortex-schema
description: Evolve Cortex page and link types while writing durable knowledge.
allowed-tools:
  - cortex_search
  - cortex_get_page
  - cortex_capture
  - cortex_edit
  - cortex_ingest
---

# Cortex Schema

Use this skill when a Cortex write needs a clearer page type or relationship
type than the active schema already names.

This is adapted from GBrain `schema-author`, but Cortex has a lighter model:
there is no separate schema-pack mutation flow for agents. Agents may introduce
new page and link types during normal Cortex writes without user approval.
Tavern Runtime records those schema additions for later review.

## Non-goals

Use other Cortex skills for adjacent work:

- Filing one specific page or research thread: `cortex-organize`.
- Querying existing Cortex knowledge or graph relationships: `cortex-query`.
- Saving an explicit memory or correction: `cortex-capture`.
- Ingesting a source artifact: `cortex-ingest`, `cortex-idea-ingest`, or
  `cortex-media-ingest`.

This skill guides schema choice. It does not run a separate approval, fork,
sync, or migration process.

## When To Invoke

Use this skill for:

- "Add a page type" or "add a type to my schema".
- "Schema author", "schema mutate", or "schema add".
- "My Cortex has untyped pages".
- "Propose new types from my corpus".
- "Backfill page types" or "evolve my schema".
- "Researcher type", "make X an expert type", "create a custom type for X",
  or "make X a type".
- "Add a link type".
- A capture, ingest, enrich, or organize flow where no existing type fits.
- A relationship that needs a clearer link type than `mentions` or `related_to`.
- Reviewing or explaining why Cortex introduced a dynamic page or link type.

Do not invoke it just to look up what a page means; use `cortex-query`.

## Contract

This skill guarantees:

- Existing page and link types are reused when they fit.
- New types are specific, lowercase kebab-case, and durable enough to be useful
  again.
- Schema additions happen as part of useful Cortex writes, not abstract taxonomy
  work.
- New types preserve provenance through the write that introduced them.
- The agent may add a clearer type on its own; do not ask for approval unless
  the user explicitly wants schema review.

## Workflow

### Phase 1 - Assess

- Prefer an existing Cortex page type when it fits.
- Inspect nearby pages with `cortex_search` or `cortex_get_page` when type
  choice is unclear.
- Do not create a synonym for an existing type.

### Phase 2 - Choose

- Page types should name durable things, such as `podcast-episode`,
  `research-artifact`, or `content-brief`.
- Link types should name relationships, such as `sourced_from`, `depends_on`,
  or `inspired_by`.
- Use lowercase kebab-case.
- Avoid broad catchalls such as `misc`, `other`, or `thing`.

### Phase 3 - Apply Inline

- For a new page type, use it as the `type` in `cortex_capture`,
  `cortex_ingest`, or `cortex_edit action: "upsert"`.
- For a new link type, include it in `cortex_edit` page links.
- Runtime records the schema addition automatically.

### Phase 4 - Report Briefly

- Mention the type only when useful or when the user asked about schema.
- Say that Cortex recorded the type for review.
- Do not turn normal capture or ingest replies into schema reports.

## Outputs

- A Cortex page write, ingest, or edit using the clearer type.
- A Runtime-recorded schema addition for any new page or link type.
- A short user-facing note only when schema choice matters.

## Anti-Patterns

- Asking for permission every time a clearer type exists.
- Blocking a useful write because the perfect type is uncertain.
- Creating one-off types for weak or transient notes.
- Creating broad bucket types such as `misc`, `other`, or `thing`.
- Renaming or consolidating schema casually; that belongs in review tooling.
