---
summary: Memory feature for per-agent briefing files, hidden episodic evidence, shared Semantic Memory, and Memory worker history.
read_when:
  - changing Memory settings, Memory visibility, briefing files, extraction, dreaming, or Semantic Memory expectations
  - changing the boundary between prompt-time context and durable Memory knowledge
---

# Memory

Memory is one Tavern feature with layered storage:

* **Agent briefing files.** Each agent workspace owns `USER.md` and `MEMORY.md`.
  These compact files are loaded into that agent's prompt when Memory is on.
* **Episodic Memory.** Background extraction writes per-agent evidence after
  chat activity settles. It is hidden worker state, not a normal editing
  surface.
* **Semantic Memory.** Shared durable knowledge lives in Markdown pages users
  can inspect and edit through the Memory page. `TAXONOMY.md` routes where
  shared knowledge belongs.

There is no shared `USER.md` or shared `MEMORY.md`. Agents only update their
own briefing files. Shared project, person, company, domain, and concept
knowledge belongs in Semantic Memory.

## In The App

The primary Memory page shows shared Semantic Memory: pages, folders, links,
backlinks, search, and the effective Memory root.

Agent Memory settings show agent-specific controls and history:

* global Memory on/off
* model category settings for Fast, Standard, Deep, and Visual work
* extraction and dreaming history
* worker status, model, token usage, costs, file changes, and source links
* explicit Dream now action
* worker transcript/tool details for debugging

## Contract

When Memory is off, Runtime does not inject briefing files, run extraction, run
dreaming, expose Memory tools, or allow Memory writes. Existing files remain on
disk but do not affect agent turns.

Explicit user requests to remember something are handled by the active agent:
agent-local preferences and defaults go to that agent's `USER.md` or
`MEMORY.md`; shared durable knowledge goes to Semantic Memory according to
`TAXONOMY.md`.

Background capture is separate. Extraction writes hidden per-agent episodic
evidence after a five-minute idle debounce. Dreaming is agent-specific and
promotes stable evidence into shared Semantic Memory. Explicit user requests to
remember agent-local preferences can update that agent's briefing files
directly.

## Related Docs

* [Memory API](../api/memory.md)
* [Context management](context-management.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
