# Memory Persistence

Memory persistence is Tavern's capture and extraction pipeline.

It turns recent conversation and runtime signal into durable memory without making every normal turn
do memory work inline. It is separate from compaction, separate from working-memory synthesis, and
separate from the long-term maintenance loop.

## Relationship To Other Memory Systems

- `compaction` manages live context pressure. It does not create durable memory.
- `activity log` records higher-signal operational events as they happen.
- `working memory` synthesizes recent activity into prompt-facing recent context.
- `memory persistence` captures bounded source ranges and extracts durable memory from them.
- `durable memory` is the long-term result of successful persistence.
- `cortex` schedules and executes persistence work in the background.

The persistence pass feeds durable memory, while working memory and tiered memory remain separate
concerns.

## Capture Boundaries

Persistence should operate on explicit capture boundaries rather than on vague "recent context."

A capture boundary is a bounded slice of source material defined by:

- the owning agent
- the relevant chat or session
- a start and end message cursor
- a start and end activity-event cursor when relevant
- the trigger that created the capture
- the active participant snapshot for that slice

The capture boundary is the unit of persistence work. Once created, the boundary should remain
stable across retries.

## Triggers

Tavern should create a new capture when one of these boundaries is crossed:

- message-count trigger: roughly 20 user messages since the last successful capture
- time-based trigger: roughly 15 minutes of active conversation since the last successful capture
- event-density trigger: roughly 5 high-signal activity events since the last successful capture
- pre-compaction trigger: context is about to be compacted and there is uncaptured material
- session-boundary trigger: a session is ending, handoff is occurring, or the runtime is shutting
  down with uncaptured material
- explicit trigger: the user, agent, or operator requests immediate persistence

The first three are the normal cadence. The compaction and session-boundary triggers are the safety
net that prevents recent high-signal context from being lost before the periodic cadence fires.

## Capture Record

Every capture should be a first-class record in Tavern.

A capture record should preserve:

- a stable capture ID
- status such as `queued`, `running`, `completed`, `failed`, or `abandoned`
- the owning agent
- the relevant chat and session when one exists
- the message start and end cursors
- the activity-event start and end cursors when used
- the trigger kind
- the captured participant snapshot
- attempt count
- created, started, completed, and failed timestamps
- last error when a run fails

Capture records should store references to source material, not duplicate the full transcript or raw
events into a second archive.

## Watermarks And Idempotency

Persistence should advance through source material by watermarks.

- Each chat or session should track a last-successful persistence watermark.
- New captures should begin at the last successful watermark and end at the current boundary.
- A repeated trigger for the exact same source range should coalesce into the existing queued or
  running capture rather than creating a second one.
- Retries should reuse the same capture record and the same source bounds.
- Successful completion should advance the persistence watermark past that captured range.
- Overlapping captures should be reserved for explicit backfill or repair flows, not normal
  operation.

This makes persistence replay-safe. A failed run can be retried without creating an ambiguous new
window, and a successful run advances the system cleanly.

## Persistence Pass

The persistence pass runs against one capture record at a time.

It should follow this order:

1. Load the bounded source slice referenced by the capture.
2. Resolve observed source identities in that slice to participants and profile links.
3. Recall relevant existing durable memory to avoid duplicate saves and detect updates.
4. Save new durable memories and update or supersede older memories when appropriate.
5. Emit activity-log events for decisions, memory saves, supersessions, and persistence outcomes.
6. Mark the capture complete and advance the persistence watermark.

## Inputs To The Persistence Pass

The pass should read a bounded, inspectable input bundle.

That bundle should include:

- transcript messages in the captured cursor range
- activity events in the captured event range
- the resolved participant map for the range
- recent durable memories relevant to that scope for duplicate avoidance and updates
- the trigger reason and capture metadata

The pass should not reread arbitrary whole-session history unless the operator explicitly requests a
backfill or repair run.

## Outputs

A successful persistence pass may produce:

- new durable memory rows
- status changes to existing durable memories such as `superseded`, `contradicted`, or `completed`
- new or updated memory associations
- activity-log events such as `decision`, `memory`, and `capture`
- a completed capture record with the exact output references it produced

The capture record should make it possible to inspect what durable memories and events came out of
that run.

## Duplicate Avoidance

Duplicate avoidance should happen in the persistence pass, not after the fact in the prompt.

- Before saving, the pass should recall nearby durable memories in the same ownership scope.
- If the new observation materially updates an existing current memory, the system should update the
  old memory's status and preserve the relationship between them rather than storing two unrelated
  copies.
- If a retry replays the same capture, the capture record and the existing current memories should
  make the write path idempotent.
- Reflection and merge remain important later, but normal persistence should already prefer updates
  over blind duplication.

## Retention And Inspection

Capture records are an audit surface, not a second transcript store.

- Source transcripts remain in chat and session history.
- Source events remain in the activity log.
- Capture records should retain only the bounded references, metadata, outputs, and errors needed
  for inspection and replay.
- Completed capture records should remain inspectable for a limited operational window, roughly 30
  days by default.
- Failed capture records should remain inspectable until resolved or expired by policy.

## Constraints

- Compaction must never be the thing that extracts durable memory.
- Persistence must run on bounded source ranges, not on fuzzy whole-session rereads.
- Persistence must be replay-safe and watermark-driven.
- Persistence must preserve participant attribution through profile or participant ids.
- Persistence must fail softly: a failed capture should not block the live session.
