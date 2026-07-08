---
summary: Memory feature for per-agent core memory files, hidden episodic evidence, shared Wiki promotion, and Memory run history.
read_when:
  - changing Memory settings, Memory visibility, core memory files, extraction, dreaming, Wiki promotion, or shared durable knowledge expectations
  - changing the boundary between prompt-time context, core Memory, and the shared Wiki
---

# Memory

Memory is Tavern's per-agent durable context feature. Wiki is the shared Markdown knowledge
surface that Memory background work and agents can update when knowledge should be visible to all agents.

* **Agent core memory files.** Each agent workspace owns `USER.md` and `MEMORY.md`.
  These compact files are loaded into that agent's prompt when Memory is on.
* **Episodic Memory.** Background extraction writes per-agent evidence after
  chat activity settles. It is hidden worker state, not a normal editing
  surface.
* **Wiki.** Shared durable knowledge lives in Markdown pages users
  can inspect and edit through the Wiki page. `TAXONOMY.md` routes where
  shared knowledge belongs.
  The Wiki root is also a local Git repository for recoverable
  on-disk history across app edits, Obsidian/Finder edits, and agent file
  writes.
* **Wiki recall index.** A derived, rebuildable search index over Wiki pages
  powers per-turn recall and `wiki_search` with keyword and semantic matching.
  Semantic matching uses a local embedding model provisioned on first index
  refresh; until it is provisioned, recall degrades to keyword search and
  per-turn recall stays off. The Markdown pages remain canonical; deleting the
  index only forces a rebuild. Recall readiness is the `wikiRecall` Runtime capability: provisioning
  (model download, page indexing) reports as degraded with live progress on
  the Runtime capabilities surface, and one-time provisioning does not appear
  in Memory run history.

There is no shared `USER.md` or shared `MEMORY.md`. Agents only update their
own core memory files. Shared project, person, company, domain, and concept
knowledge belongs in Wiki.

## In The App

The Wiki page shows shared pages, folders, links, backlinks, search, and the
effective Wiki root.

The global Memory settings page (Settings → Memory) owns everything else:

* Memory on/off
* a health banner when background work cannot run, linking to Models settings
* combined capture and dream history across all agents, attributed per run
* per-run outcomes: what was saved, files updated, or why nothing changed
* an explicit per-agent Dream now action

History updates live: background capture and dream runs push a runtime event
that refreshes the list, so new rows appear without reopening the page.

Episodic evidence follows the home timezone (Tavern Runtime settings): day
files bucket by the user's calendar day and entry headings carry local time
with offset, so time-of-day patterns survive into dreams.

Memory is not an agent settings tab; per-agent internals (episodic files,
core memory files, dream scoping) do not need per-agent navigation.

The Fast and Standard model categories live on the Models settings page. They
are generic Runtime settings for background work — Memory consumes them
(capture uses Fast, dreaming uses Standard) but future background features may
too. Automatic prefers a direct model connection because category consumers
run headless model calls.

## Contract

When Memory is off, Runtime does not inject core memory files, run extraction, or
run dreaming. Existing Memory files remain on disk but do not affect agent turns.
Wiki pages and Wiki tools remain available through the separate Wiki surface.
The `memory` Runtime capability reports whether Memory is on and each registered
agent workspace can hold that agent's core memory files.

Explicit user requests to remember something are handled by the active agent:
agent-local preferences and defaults go to that agent's `USER.md` or
`MEMORY.md` through workspace file edits; shared durable knowledge goes to Wiki
through the agent Wiki tools (`wiki_list`, `wiki_search`, `wiki_read`,
`wiki_write`, `wiki_backlinks`, `wiki_move`, `wiki_delete`) according to
`TAXONOMY.md`.

Background capture is separate. Extraction runs a Fast-category model over the
settled message window after a five-minute idle debounce and appends distilled
observations to hidden per-agent episodic evidence. Large backlogs — including
first-run backfill of a pre-existing chat — paginate into bounded chunks, one
model call per chunk, so no message is ever skipped. Extraction reads only
user-visible chat messages and final replies; tool activity never enters it.
Dreaming is agent-specific, runs only when that agent has new evidence since
its last dream, and promotes stable evidence into Wiki or that agent's own core
memory files.

Wiki deletes are authoritative for background work. Runtime records
local Git history before destructive page/folder mutations and after writes;
the filesystem watcher commits external Markdown edits after its live-update
debounce. When dreaming tries to create a missing page, Runtime refuses the
write if Git shows that path was deleted recently. Explicit user creates can
restore a path, and normal dream updates to an existing restored page continue
through hash checks.

Memory background work is cost-bounded: failed extractions retry a few times and then
wait for new chat activity (resuming from the last completed chunk),
consecutive dream failures back off exponentially, episodic input to one dream
is size-capped, and finished worker job records are pruned after thirty days.

Memory background work runs as direct model calls, so it needs at least one direct
model connection (OpenAI, OpenRouter, or an OpenAI-compatible endpoint) even
when chats run through an agent harness. The `memoryExtraction` and
`memoryDreaming` Runtime capabilities report readiness for extraction and
dreaming separately, and both go unavailable while Memory is off. When either
is unavailable, the Memory page explains the fix, no affected background work
is queued, and background model categories can be chosen in Models settings
(Fast: extraction, Standard: dreaming and skill review, Deep: curation).

## Background Work

The Memory settings page shows the background activity surface: one row per
activity kind (extraction, dreaming, skill review, curation) with its last run and
next planned run or the condition it waits on, a timeline of runs over the
last two weeks, and a per-run report drawer (extraction observations and
learning signals, dream outcomes, skill review actions, curator
consolidations and prunings). Automations are separate; the Automations page owns
their run history.

## Related Docs

* [Wiki](wiki.md)
* [Memory API](../api/memory.md)
* [Context management](context-management.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
