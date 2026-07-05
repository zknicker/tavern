---
summary: Memory API boundary for global Memory settings, per-agent core memory injection, hidden episodic evidence, and shared Semantic Memory.
read_when:
  - changing Memory settings, prompt-time core memory injection, extraction, dreaming, or Memory visibility
  - changing the boundary between agent workspace memory and shared Semantic Memory
  - changing how agents or users inspect durable Memory knowledge
---

# Memory API

Memory is Tavern's durable knowledge contract. It has three layers:

* Layer 1: each agent workspace owns `USER.md` and `MEMORY.md`. Runtime injects
  those core memory files into that agent's system prompt only when Memory is on.
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

When Memory is off, Runtime does not inject core memory files, run extraction, run
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

The shared root seeds `TAXONOMY.md` and semantic folders, not agent core memory
files and not episodic files.

## Workers

Extraction and dreaming are Runtime background workers. Extraction distills a
deterministic window of settled user-facing chat messages into episodic
observations with the Fast model category, paginating large backlogs into
bounded chunks so no message is skipped. Dreaming uses the Standard model
category with a restricted tool set covering shared Semantic Memory pages and
the owning agent's own core memory files; it does not run the normal chat agent
prompt, chat tools, or skill set.

Content mutation routes return a conflict while Memory is off; Memory and
model-category settings stay editable.

Worker job history, cursors, debounce state, usage, errors, and touched-file
records are Runtime database state; finished job records are pruned after
thirty days. The durable knowledge itself remains Markdown on disk.

Job records store UTC timestamps. Episodic Markdown is written in the home
timezone from `/timezone/settings`: day files bucket by the local calendar day
and entry headings use local ISO time with offset.

Every memory job state change publishes a `memoryJob.updated` runtime event.
The server maps it to the `memoryJobs.updated` invalidation event behind
`memory.onJobsUpdate`, so clients keep worker history live without polling.

## Related Docs

* [Memory feature](../features/memory.md)
* [Context management](../features/context-management.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
