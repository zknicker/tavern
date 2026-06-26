---
name: memory
description: >
  Use for durable memory, user profile notes, agent operating notes, episodic
  observations, semantic subject notes, routine memory, project context,
  research notes, and long-term agent-readable context.
---

# Memory

Managed by Tavern. Do not edit this skill directory; Tavern refreshes
it on startup. For durable agent-managed skill changes, create or update a
separate skill in your normal skills directory.

The memory root is durable Markdown for facts and context worth remembering.
The user can inspect it, and agents maintain it.

Use this skill for direct Memory work: when the user asks you to remember,
forget, or update durable context, or when the current run is explicitly Memory
maintenance. Do not turn ordinary task progress into Memory edits.

## Path

Use the Tavern memory path. If `TAVERN_VAULT_PATH` is set, it overrides the
default. Otherwise use the managed Tavern memory directory. Do not guess
sibling memory roots.

## L1 Root Files

`MEMORY.md` is the compact operating briefing.

`USER.md` is the compact user briefing.

`TAXONOMY.md` is the routing contract. Read it before changing Memory
structure.

## Routing

Append raw observations to `episodic/YYYY-MM-DD.md` when they are sparse,
event-shaped, uncertain, or not ready to promote.

Write stable project knowledge under `projects/`.

Use `routines/<routine-slug>/MEMORY.md` for recurring workflow memory.

For other stable categories, add a narrow semantic folder to `TAXONOMY.md`
before creating the folder. Do this only when repeated future use justifies a
new durable home.

Refresh `MEMORY.md` or `USER.md` only when stable, high-value context should be
loaded at session start.

## Conventions

Do not store secrets, credentials, full chat dumps, temporary task progress, or
speculative claims.

Before creating a semantic page, search for related existing pages.

For semantic updates, add a `## History` evidence entry before changing
`## Current`.

Do not pre-create broad folders for every possible subject.

Keep Memory pages concise, source-backed, and easy to inspect.
