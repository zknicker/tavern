# Memory Persistence

Memory persistence is an agent workflow for turning bounded source material
into Vault updates.

It does not create a separate durable memory-record database, capture queue, or
Runtime-owned write pipeline.

## Relationship To Other Memory Systems

* **Compaction** manages live context pressure. It does not write durable
  memory.
* **Activity log** records higher-signal operational events as they happen.
* **Working memory** synthesizes recent activity into prompt-facing context.
* **Memory persistence** writes bounded source-backed updates into Vault when an
  agent or operator asks for that work.
* **Vault** is the durable wiki that stores the result.

## Capture Boundaries

Persistence should operate on explicit source boundaries, not vague "recent
context."

A good handoff preserves:

* owning agent
* relevant chat or session
* start and end message cursor
* relevant activity-event cursor when available
* trigger kind
* participant snapshot
* attempts, timestamps, outputs, and errors

Source references are preferable to copying whole chat history into Vault.

## Persistence Pass

The agent workflow:

1. Load the bounded source slice.
2. Resolve observed source facts to participants.
3. Search related Vault pages to avoid duplicate pages and detect updates.
4. Update durable notes, timelines, links, tags, and source metadata.
5. Add useful wikilinks and backlinks.
6. Update `INDEX.md` if navigation changed.

The pass does not reread arbitrary whole-session history unless the operator
requests a backfill or repair run.

## Outputs

A successful persistence pass may produce:

* new or updated Vault pages
* new timeline entries
* new or updated links, tags, citations, or source metadata
* an agent-visible summary of what changed

## Constraints

* Compaction must never be the thing that writes durable Vault memory.
* Persistence must run on bounded source ranges.
* Persistence must preserve participant attribution through profile or
  participant ids.
* Persistence failures must not block the live session.
