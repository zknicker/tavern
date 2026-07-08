---
summary: Memory API boundary for global Memory settings, per-agent core memory injection, hidden episodic evidence, and the shared Wiki.
read_when:
  - changing Memory settings, prompt-time core memory injection, extraction, dreaming, or Memory visibility
  - changing the boundary between agent workspace memory and the shared Wiki
  - changing how agents or users inspect durable Wiki knowledge
---

# Memory API

Memory is Tavern's per-agent durable context contract. Wiki is the separate shared Markdown knowledge
surface.

Memory has two storage layers:

* Core memory: each agent workspace owns `USER.md` and `MEMORY.md`. Runtime injects
  those core memory files into that agent's system prompt only when Memory is on.
* Episodic Memory: hidden per-agent evidence from
  chat activity. Normal agents do not edit it.

There is no shared `USER.md` or shared `MEMORY.md`. Shared knowledge belongs in
Wiki pages routed by `TAXONOMY.md`.

## Settings

Runtime exposes global Memory enablement through:

* `GET /memory/settings`
* `PUT /memory/settings`

When Memory is off, Runtime does not inject core memory files, run extraction, or
run dreaming. Existing Memory files remain on disk but are inert until Memory is
re-enabled. Wiki pages and Wiki tools are separate from this switch.

Runtime exposes background-work model categories through:

* `GET /model-categories/settings`
* `PUT /model-categories/settings`

Unset category values mean automatic default model selection. Extraction uses
Fast, dreaming uses Standard, and future heavy repair/import work may use Deep.

## Wiki

Runtime exposes Wiki through Runtime APIs for:

* status and settings
* Markdown page/folder reads and writes
* lightweight lexical search
* backlinks derived from `[[wikilinks]]`

The shared root seeds `TAXONOMY.md` and Wiki folders, not agent core memory
files and not episodic files.

The shared root is initialized as a local Git repository. Runtime records
best-effort commits for root preparation, page/folder mutations, agent Memory
and Wiki tool writes, and external Markdown changes observed by the Wiki
watcher. Git history is local recovery state and the deletion signal for
background workers; it is not a remote backup contract. Agent-created missing
pages are rejected when recent Git history shows that path was deleted, while
explicit user creates can restore the path.

## Background Activity

Extraction and dreaming are Runtime background workers. Extraction distills a
deterministic window of settled user-facing chat messages into episodic
observations with the Fast model category, paginating large backlogs into
bounded chunks so no message is skipped. Dreaming uses the Standard model
category with a restricted tool set covering shared Wiki pages and
the owning agent's own core memory files; it does not run the normal chat agent
prompt, chat tools, or skill set.

Runtime exposes Memory background state through:

* `GET /memory/activity` for the current per-kind rollup: enabled state, latest
  run, and next scheduled run or waiting condition.
* `GET /memory/jobs` for run history.
* `GET /memory/jobs/{id}` for one run report.

Background Memory mutation routes return a conflict while Memory is off; Memory
and model-category settings stay editable.

Worker job history, cursors, debounce state, usage, errors, and touched-file
records are Runtime database state; finished job records are pruned after
thirty days. The durable knowledge itself remains Markdown on disk.

Job records store UTC timestamps. Episodic Markdown is written in the home
timezone from `/timezone/settings`: day files bucket by the local calendar day
and entry headings use local ISO time with offset.

Every memory job state change publishes a `memoryJob.updated` runtime event.
The server maps it to the `memoryJobs.updated` invalidation event behind
`memory.onJobsUpdate`, so clients keep Memory run history live without polling.

## Related Docs

* [Memory feature](../features/memory.md)
* [Context management](../features/context-management.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
