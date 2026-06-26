---
summary: Memory feature for durable Markdown knowledge, L1 briefings, semantic pages, episodic observations, and Memory browsing.
read_when:
  - changing Memory browsing, Memory settings, durable knowledge storage, or agent memory prompts
  - changing the boundary between Memory, Workspace, and managed runtime context
---

# Memory

Memory is Tavern's durable knowledge store. It is plain Markdown on the local
filesystem, owned by the user and maintained by the user and agents.

Memory replaces the old separate knowledge surface. Users browse one Memory
root; direct Memory edits and maintenance workflows write that same root.

## Root Layout

Runtime seeds the configured Memory root with:

* `MEMORY.md` — compact agent operating briefing
* `USER.md` — compact user briefing
* `TAXONOMY.md` — routing rules for Memory writes
* `episodic/` — append-only dated observations
* `projects/` — durable project context and decisions
* `routines/` — recurring workflow memory

Other semantic folders are not pre-guessed. Agents add them to `TAXONOMY.md`
only when a stable repeated category needs its own durable home.

## In The App

The Memory page shows the Memory file browser and editor. Users can inspect
Markdown files, folders, search results, backlinks, metadata, and live file
status. The legacy `/dashboard/vault` route redirects to `/dashboard/memory`.

Settings -> Memory controls the Memory path. If `TAVERN_VAULT_PATH` is set, the
environment path wins until the wire setting is renamed.

## Agent Contract

The main chat agent does not turn ordinary task progress into Memory edits.
Memory maintenance workflows handle normal capture. When a user explicitly asks
the agent to remember, forget, or update durable context, the agent uses the
managed `memory` skill and reads `TAXONOMY.md` before changing Memory
structure.

Maintenance workflows write raw observations to `episodic/YYYY-MM-DD.md`,
promote stable project or routine knowledge into semantic pages, add new
semantic folders only through `TAXONOMY.md`, and refresh `MEMORY.md` or
`USER.md` only when the context is valuable enough to load at session start.

The `memory` managed skill describes this contract to the agent. Internal API
and tRPC names can still say `vault` for compatibility.

## Boundary

Memory stores knowledge. Workspace stores working files under `workbench/`.
Prompt context stays bounded and should retrieve selected Memory material
rather than loading the whole root.
