# Memories

Memory is Tavern's durable knowledge system.

Runtime exposes one filesystem-backed Memory root. The root contains compact
L1 briefing files, semantic pages, episodic observations, and routine memory.
There is no separate product knowledge store.

## Root Layout

The managed Memory root contains:

```txt
MEMORY.md
USER.md
TAXONOMY.md
episodic/
projects/
routines/
```

`MEMORY.md` is the compact agent operating briefing.

`USER.md` is the compact user briefing.

`TAXONOMY.md` is the routing contract for Memory writes.

`episodic/YYYY-MM-DD.md` holds append-only raw observations grouped by date.

Project pages live under `projects/`. Routine memory lives under
`routines/<routine-slug>/MEMORY.md`.

Other semantic folders are taxonomy-owned. Agents add them only when a stable
category needs a durable home, has repeated future use, and does not fit an
existing folder.

## Write Model

Direct Memory edits and maintenance workflows write raw, sparse, or uncertain
observations to episodic Memory first. Dreaming promotes repeated, strong, or
broadly useful observations into projects, routines, or a taxonomy-defined
semantic folder. L1 briefing files are refreshed only when stable context should
load at session start.

The main chat agent normally leaves capture to Memory maintenance workflows. If
the user explicitly asks it to remember, forget, or update durable context, it
uses the managed `memory` skill and reads `TAXONOMY.md` before changing Memory
structure.

Semantic pages use frontmatter plus `## Current` and `## History`. `## History`
preserves evidence before `## Current` changes.

Memory must not store secrets, credentials, full chat dumps, temporary task
progress, or speculative claims.

## Inspection

The Memory page is the browsable file surface for the Memory root. It shows
Markdown files, folders, search results, backlinks, metadata, edit/preview
modes, and filesystem status.

The route `/dashboard/vault` is a compatibility redirect to
`/dashboard/memory`. Internal API names can still use `vault` until the wire
contract is renamed.

## Prompt Continuity

Prompt-facing context is bounded. It can include stable identity context,
participant context, recent activity, and selected Memory material, but it must
not dump the entire Memory root or every recent search result.

## Constraints

* Memory must not cause one agent's context to bleed into another agent.
* Person context must not leak into unrelated participants.
* Prompt context must stay bounded.
* Durable knowledge remains inspectable as Markdown.
