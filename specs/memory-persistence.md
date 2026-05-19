# Memory Persistence

Memory persistence is Tavern's bounded capture and Cortex write pipeline.

It turns recent conversation and runtime signal into Cortex page updates,
timeline entries, links, tags, and source metadata. It does not create a
separate durable memory-record database.

## Relationship To Other Memory Systems

* **Compaction** manages live context pressure. It does not write durable
  memory.
* **Activity log** records higher-signal operational events as they happen.
* **Working memory** synthesizes recent activity into prompt-facing context.
* **Memory persistence** captures bounded source ranges and writes Cortex
  updates from them.
* **Cortex** is the durable brain that stores the result.

## Capture Boundaries

Persistence operates on explicit source boundaries, not on vague "recent
context."

A capture boundary preserves:

* owning agent
* relevant chat or session
* start and end message cursor
* start and end activity-event cursor when relevant
* trigger kind
* participant snapshot
* attempts, timestamps, outputs, and errors

Capture records store references to source material, not a second copy of chat
history or raw events.

## Triggers

Tavern creates capture records when these boundaries are crossed:

* roughly 20 user messages since the last successful capture
* roughly 15 minutes of active conversation since the last successful capture
* roughly 5 high-signal activity events since the last successful capture
* pre-compaction when uncaptured material is about to fall out of context
* session boundary or handoff
* explicit user, agent, or operator request

Compaction and session-boundary triggers are the safety net. They create stable
source bounds before context becomes less reliable.

## Persistence Pass

The persistence pass runs against one capture record at a time.

1. Load the bounded source slice.
2. Resolve observed identities to participants and profile links.
3. Recall relevant Cortex pages to avoid duplicate pages and detect updates.
4. Update compiled truth, append timeline evidence, and maintain links, tags,
   and source metadata.
5. Emit activity events for decisions, capture output, corrections, and
   persistence outcomes.
6. Mark the capture complete and advance the watermark.

The pass does not reread arbitrary whole-session history unless the operator
requests a backfill or repair run.

## Outputs

A successful persistence pass may produce:

* new or updated Cortex pages
* new timeline entries
* new or updated links, tags, citations, or source metadata
* activity events
* a completed capture record with output references

The capture record makes it possible to inspect what Cortex material came out of
that run.

## Idempotency

Persistence advances through source material by watermarks.

Repeated triggers for the same source range coalesce into the existing queued or
running capture. Retries reuse the same capture record and source bounds.
Successful completion advances the watermark past the captured range.

Normal persistence avoids overlapping captures. Overlap is reserved for explicit
backfill or repair.

## Constraints

* Compaction must never be the thing that writes durable Cortex memory.
* Persistence must run on bounded source ranges.
* Persistence must be replay-safe and watermark-driven.
* Persistence must preserve participant attribution through profile or
  participant ids.
* Persistence must fail softly: a failed capture does not block the live
  session.
