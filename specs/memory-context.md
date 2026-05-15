# Memory Context

Memory context is Tavern's layered continuity system for active sessions.

It replaces a monolithic memory bulletin with independently managed layers. Each layer has its own
data source, refresh strategy, and rendering path. The active session should receive one bounded
memory-context block assembled from those layers rather than a single LLM-written blob that tries
to handle identity, recent activity, long-term knowledge, and participant awareness all at once.

In Tavern, this memory-context system is the ambient continuity surface around the live session.
Stable identity context such as persisted identity files, agent instructions, and similar files
should be treated as one layer inside this system rather than as a separate parallel prompt surface.

## Relationship To Other Memory Systems

Memory context is only one part of the overall memory model.

- `activity log` is the append-only event log and audit surface for what happened across the system.
- `working memory` is the recent synthesized understanding derived from that activity log.
- `memory persistence` captures bounded recent source ranges and extracts durable memory from them.
- `durable memory` is the long-term typed memory store.
- `tiered durable memory` changes how durable memories are ranked and maintained during recall.
- `memory context` is the prompt-facing assembly that combines the relevant recent and long-term
  continuity signals for an active session.

Working memory tells the session what is happening now. Durable memory tells the session what
should keep mattering. Tiered durable memory improves which durable memories surface first. Memory
context assembles the bounded continuity view the session actually receives.

## Layered Assembly

Tavern memory context should be assembled from five independently managed layers.

| Layer | Purpose | Source | Refresh strategy | Rendering |
| --- | --- | --- | --- | --- |
| `Identity Context` | Stable persona, role, and standing instructions | Agent-owned files and config | On file or config change | Programmatic |
| `Working Memory` | What happened recently and what remains in motion | Activity log + cached syntheses | Fresh on every turn from cached rows and cheap queries | Programmatic |
| `Activity Map` | What is happening elsewhere right now | Activity log + live runtime state | Fresh on every turn | Programmatic |
| `Participant Context` | Who is active in this session and what matters about them | Participant metadata + recent activity | Fresh on every turn from cached summaries and queries | Mostly programmatic |
| `Knowledge Synthesis` | Long-term knowledge that does not belong in recent situational layers | Durable memory | On dirty flag with debounce | LLM-synthesized and cached |

No layer should depend on another layer for its source content. The layers are composed at prompt
assembly time, but each layer should be owned by its own system and be understandable in isolation.

## Layer 1: Identity Context

Identity context is the stable layer.

- It carries the agent's persona, role, authority, standing instructions, and stable product or
  workspace identity.
- It should be rendered directly from agent-owned files or config.
- It should update only when those files or settings change.
- It should not be repeatedly re-synthesized into another prose blob.

Identity context remains user-authored. It is not a memory summary. The important change is that
it is treated as one layer of the memory-context assembly rather than as a separate prompt concept.

## Layer 2: Working Memory

Working memory is the recent, synthesized view of meaningful activity.

- Working memory should answer what happened recently, what changed, what completed, what failed,
  and what is still in motion.
- Working memory should be built from the activity log rather than from full transcript rereads on
  every turn.
- Working memory should be narrative-first. It should prefer readable recent syntheses over a raw
  scrolling event tail.

Working memory should render:

- today's intraday synthesis blocks
- a short raw tail of the most recent unsynthesized events
- yesterday's summary
- a compressed view of this week

Today's layer should be the richest. Older recent periods should be progressively compressed.

### Intraday Synthesis

Tavern should synthesize today's activity in batches.

- An intraday synthesis batch should trigger after roughly 15 unsynthesized events by default.
- A time-based fallback should trigger after roughly 4 hours if unsynthesized events exist but have
  not yet reached the batch threshold.
- Each intraday synthesis should cover only the new batch since the last synthesis, not the whole
  day.
- Each synthesis block should stay short and narrative, roughly 50-100 words.

### Daily Summary

At day rollover, Tavern should synthesize yesterday into one daily summary.

- The daily summary should be derived from the intraday synthesis blocks rather than from the full
  raw event stream.
- A daily summary should require only one synthesis call per day.
- Daily summaries should become the canonical recent-history representation once a day has rolled
  over.

### Rendering Rules

- Today's synthesis blocks and raw tail should receive most of the token budget.
- Yesterday's summary should appear after today's view.
- This week's view should be compressed from recent daily summaries.
- Events from the current chat, session, or active work surface should receive priority.
- Once raw events have been synthesized into an intraday block, the synthesis should replace them
  in the prompt-facing context.

Working memory should be bounded. A default token budget around 1500 tokens for the whole working
memory layer is appropriate.

## Layer 3: Activity Map

The activity map should surface what is happening elsewhere for the same agent without injecting
full transcripts. In Tavern, this should include more than channels:

- other chats for the same agent
- active sessions and child work
- active workers or long-running tasks
- recent cron or job outcomes
- recent deliveries between sessions or agents
- recent model or provider changes that affect the current working environment

The activity map should be fully programmatic and cheap to render.

- It should update from projected runtime state and the activity log.
- It should prefer one-line summaries with time since last activity, active participants, and a
  short topic hint.
- It should stay bounded, with a default budget around 300 tokens.
- Inactive surfaces older than roughly 24 hours should collapse or drop out.
- Only surfaces for the same agent should appear in this layer by default.

## Layer 4: Participant Context

Participant context gives the session ambient awareness of who it is talking to.

- Participant context should start from active observed participants in the session and resolve
  manual profile links before any person-level memory is assembled.
- Participant context should render for the most recently active participants in the current
  session.
- Participant context should be grounded in profile or participant identity, participant
  observations, participant relationships, and recent activity.
- It should combine participant metadata, participant knowledge, and recent activity from the
  activity log.
- It should include a short profile and a short recent-activity line.
- It should remain bounded, with a default budget around 400 tokens and a cap of roughly 5
  participants.
- When active participants share a display name, the rendered participant context should
  disambiguate them rather than collapsing them.

Participant context should therefore be keyed by participant, not by sender label. The prompt
should be aware of the current people in the session because Tavern resolved the active source
identities into participants first.

## Layer 5: Knowledge Synthesis

Knowledge synthesis is the long-term knowledge layer that remains after identity, recent activity,
ambient activity, and participant context have been separated out.

Knowledge synthesis should contain:

- active goals and strategic direction
- cross-cutting themes and patterns from durable memory
- known gaps in knowledge
- accumulated long-term observations

Knowledge synthesis should not contain:

- identity or role instructions
- recent events
- activity-map content
- participant profiles

Knowledge synthesis should be LLM-synthesized but only when the underlying durable memory changes.

- Tavern should track a dirty version for long-term knowledge synthesis.
- Regeneration should be debounced, with a default debounce around 60 seconds.
- An idle agent with no memory changes should trigger zero synthesis calls.
- A busy agent should regenerate after activity settles, not on every small update.

Knowledge synthesis is the closest successor to the old bulletin, but it is narrower and cleaner.
A default budget around 500 tokens is appropriate.

## Memory Capture Policy

Tavern should be explicit about when durable memories are extracted.

The compactor should not create memories.

- Compaction exists to manage context pressure, not to act as a memory extraction system.
- The compactor's output should be a compaction summary only.

Durable memory extraction should instead happen through a persistence pass with explicit triggers:

- message-count trigger: roughly every 20 user messages
- time-based trigger: roughly every 15 minutes of active conversation
- event-density trigger: roughly 5 high-signal activity-log events since the last persistence pass
- pre-compaction trigger: context is about to be compacted and uncaptured material exists
- session-boundary trigger: the session is ending or handing off with uncaptured material
- explicit trigger: an optional tool or command when the user or agent knows something important
  just happened

These triggers should create bounded capture records, not vague "save memory now" requests. The
capture contract is defined in `memory-persistence.md`.

- Each trigger should capture a specific message and event range.
- Pre-compaction and session-boundary triggers should immediately create a capture when uncaptured
  material exists.
- The persistence pass should operate on that captured range later in background work.
- Successful completion should advance a persistence watermark so the next capture starts where the
  prior one ended.

This persistence pass should have dual output:

- save durable memories into the graph memory system
- emit decision and memory-related events into the activity log

For participant-specific capture, the persistence pass should attach person-level memories to a
linked profile when one exists and otherwise to the observed participant. The observed platform
identity should remain in provenance.

Decision events come from three places:

- programmatic decisions observed from runtime state, such as model changes, permission changes, or
  task-state changes
- the persistence pass identifying decisions in recent conversation and work output
- an explicit user or agent action that records a decision directly

## Background Synthesis Loop

This layered system assumes a background synthesis loop that is separate from live sessions.

That loop should own:

- intraday working-memory synthesis
- day-rollover daily summaries
- knowledge-synthesis dirty-flag regeneration
- participant-summary refresh when richer participant summaries exist
- pruning of old raw activity and old recent syntheses

The Cortex is the Tavern-owned background observer and synthesizer that keeps the memory-context
system current without making the active runtime session do that work itself.

## Bulletin Compatibility

The bulletin remains the bounded prompt-facing continuity surface.

In Tavern, the bulletin should now be understood as the cached rendered output of the memory-context
assembly. It should not be a single freeform prose blob assembled from everything in memory.

- Working memory should populate the recent situational part of the bulletin.
- The activity map should populate the ambient "what else is going on" part.
- Participant context should populate the "who am I talking to" part.
- Knowledge synthesis should populate the long-term knowledge part.

This keeps prompt continuity stable while allowing each layer to refresh independently.
