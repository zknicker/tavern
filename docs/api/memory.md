---
summary: Memory API boundary for global Memory settings, per-agent briefing injection, hidden episodic evidence, and shared Semantic Memory.
read_when:
  - changing Memory settings, prompt-time briefing injection, extraction, dreaming, or Memory visibility
  - changing the boundary between agent workspace memory and shared Semantic Memory
  - changing how agents or users inspect durable Memory knowledge
---

# Memory API

Memory is Tavern's durable knowledge contract. It has three layers:

* Layer 1: each agent workspace owns `USER.md` and `MEMORY.md`. Runtime injects
  those briefing files into that agent's system prompt only when Memory is on.
* Layer 2: hidden per-agent Episodic Memory stores extraction evidence from
  chat activity. Normal agents do not edit it.
* Layer 3: shared Semantic Memory is the browsable Markdown knowledge surface
  users inspect in the app.

There is no shared `USER.md` or shared `MEMORY.md`. Shared knowledge belongs in
Semantic Memory pages routed by `TAXONOMY.md`.

## Settings

Runtime exposes global Memory enablement through:

* `GET /memory/settings`
* `PUT /memory/settings`

When Memory is off, Runtime does not inject briefing files, run extraction, run
dreaming, expose Memory tools, or allow Memory writes. Existing files remain on
disk but are inert until Memory is re-enabled.

Runtime exposes background-work model categories through:

* `GET /model-categories/settings`
* `PUT /model-categories/settings`

Unset category values mean automatic default model selection. Extraction uses
Fast, dreaming uses Standard, and future heavy repair/import work may use Deep.

## Semantic Memory

Runtime exposes Semantic Memory through Memory APIs for:

* status and settings
* Markdown page/folder reads and writes
* lightweight lexical search
* backlinks derived from `[[wikilinks]]`

The shared root seeds `TAXONOMY.md` and semantic folders, not agent briefing
files and not episodic files.

## Workers

Extraction and dreaming are Runtime background workers. Extraction is a
deterministic worker over settled user-facing chat messages. Dreaming uses the
Standard model category with a restricted Semantic Memory tool set; it does not
run the normal chat agent prompt, chat tools, or skill set.

Worker job history, cursors, debounce state, usage, errors, and touched-file
records are Runtime database state. The durable knowledge itself remains
Markdown on disk.

## Related Docs

* [Memory feature](../features/memory.md)
* [Context management](../features/context-management.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
