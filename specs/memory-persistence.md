# Memory Persistence

Memory persistence is an agent workflow for turning bounded source material
into Memory updates.

It does not create a separate durable memory-record database, capture queue, or
Runtime-owned write pipeline.

## Relationship To Other Memory Systems

* **Compaction** manages live context pressure. It does not write durable
  Memory.
* **Activity log** records higher-signal operational events as they happen.
* **Working memory** synthesizes recent activity into prompt-facing context.
* **Memory persistence** writes bounded source-backed updates into Memory when
  an agent or operator asks for that work.
* **Memory** is the durable Markdown root that stores the result.

## Capture Boundaries

Persistence should operate on explicit source boundaries, not vague recent
context.

A good handoff preserves owning agent, relevant chat or session, source cursor
ranges, trigger kind, participant snapshot, attempts, timestamps, outputs, and
errors.

Source references are preferable to copying whole chat history into Memory.

## Persistence Pass

The agent workflow:

1. Load the bounded source slice.
2. Resolve observed source facts to participants.
3. Search related Memory files to avoid duplicate pages and detect updates.
4. Append raw observations to episodic Memory when they are not ready to promote.
5. Update semantic `## History` evidence and `## Current` state when stable
   understanding changed.
6. Refresh `MEMORY.md` or `USER.md` only when stable context should load at
   session start.

The pass does not reread arbitrary whole-session history unless the operator
requests a backfill or repair run.

## Outputs

A successful persistence pass may produce new or updated episodic entries,
semantic pages, L1 briefings, links, tags, citations, or source metadata.

## Constraints

* Compaction must never be the thing that writes durable Memory.
* Persistence must run on bounded source ranges.
* Persistence must preserve participant attribution through profile or
  participant ids.
* Persistence failures must not block the live session.
