---
summary: Memory feature for per-agent core memory files, hidden episodic evidence, shared Semantic Memory, and Memory worker history.
read_when:
  - changing Memory settings, Memory visibility, core memory files, extraction, dreaming, or Semantic Memory expectations
  - changing the boundary between prompt-time context and durable Memory knowledge
---

# Memory

Memory is one Tavern feature with layered storage:

* **Agent core memory files.** Each agent workspace owns `USER.md` and `MEMORY.md`.
  These compact files are loaded into that agent's prompt when Memory is on.
* **Episodic Memory.** Background extraction writes per-agent evidence after
  chat activity settles. It is hidden worker state, not a normal editing
  surface.
* **Semantic Memory.** Shared durable knowledge lives in Markdown pages users
  can inspect and edit through the Memory page. `TAXONOMY.md` routes where
  shared knowledge belongs.

There is no shared `USER.md` or shared `MEMORY.md`. Agents only update their
own core memory files. Shared project, person, company, domain, and concept
knowledge belongs in Semantic Memory.

## In The App

The primary Memory page shows shared Semantic Memory: pages, folders, links,
backlinks, search, and the effective Memory root.

The global Memory settings page (Settings → Memory) owns everything else:

* Memory on/off
* a health banner when background work cannot run, linking to Models settings
* combined capture and dream history across all agents, attributed per run
* per-run outcomes: what was saved, files updated, or why nothing changed
* an explicit per-agent Dream now action

Memory is not an agent settings tab; per-agent internals (episodic files,
core memory files, dream scoping) do not need per-agent navigation.

The Fast and Standard model categories live on the Models settings page. They
are generic Runtime settings for background work — Memory consumes them
(capture uses Fast, dreaming uses Standard) but future background features may
too. Automatic prefers a direct model connection because category consumers
run headless model calls.

## Contract

When Memory is off, Runtime does not inject core memory files, run extraction, run
dreaming, expose Memory tools, or allow Memory writes. Existing files remain on
disk but do not affect agent turns.

Explicit user requests to remember something are handled by the active agent:
agent-local preferences and defaults go to that agent's `USER.md` or
`MEMORY.md` through workspace file edits; shared durable knowledge goes to
Semantic Memory through the agent Memory tools (`memory_list_pages`,
`memory_search`, `memory_read_page`, `memory_write_page`) according to
`TAXONOMY.md`.

Background capture is separate. Extraction runs a Fast-category model over the
settled message window after a five-minute idle debounce and appends distilled
observations to hidden per-agent episodic evidence. Large backlogs — including
first-run backfill of a pre-existing chat — paginate into bounded chunks, one
model call per chunk, so no message is ever skipped. Extraction reads only
user-visible chat messages and final replies; tool activity never enters it.
Dreaming is agent-specific, runs only when that agent has new evidence since
its last dream, and promotes stable evidence into shared Semantic Memory or
that agent's own core memory files.

Memory workers are cost-bounded: failed extractions retry a few times and then
wait for new chat activity (resuming from the last completed chunk),
consecutive dream failures back off exponentially, episodic input to one dream
is size-capped, and finished worker job records are pruned after thirty days.

Memory workers run as direct model calls, so they need at least one direct
model connection (OpenAI, OpenRouter, or an OpenAI-compatible endpoint) even
when chats run through an agent harness. The `memoryWorkers` Runtime
capability reports this; when it is unavailable the Memory page explains the
fix, no background work is queued, and the Fast/Standard background models can
be chosen in Models settings.

## Related Docs

* [Memory API](../api/memory.md)
* [Context management](context-management.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
