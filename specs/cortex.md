# Cortex

The Cortex is Tavern's background continuity system for the primary agent.

It lives inside Tavern beside memories, jobs, projections, and activity systems. Its job is to keep
continuity current without making the live runtime session do that work turn by turn.

Tavern should treat the Cortex as a built-in Tavern capability, not as a separate product the user
has to discover or configure before memory and continuity work.

## Purpose

The Cortex exists because live sessions and background continuity have different jobs.

- Live sessions handle direct interaction, tool use, and immediate task execution.
- The Cortex watches structured state across the whole agent and handles background upkeep,
  synthesis, and due-work coordination.

This separation keeps the foreground conversation simple. The session should not need to maintain
its own long-running view of recent activity, re-summarize the day on demand, or decide every turn
which maintenance work is overdue.

## What The Cortex Is

The Cortex is the agent-scoped observer and coordinator for background work.

- It is Tavern-owned.
- It is scoped to one agent.
- It sits above any single chat, session, or worker.
- It reads structured Tavern projections and writes back into Tavern-owned continuity systems.
- It is mostly idle until some background responsibility becomes due.

The Cortex should be the system that notices change, determines what background work is now needed,
and updates the relevant continuity surfaces.

## What The Cortex Is Not

The Cortex should stay clearly bounded.

- It is not the agent's persona.
- It is not a second memory store.
- It is not a transcript archive.
- It is not a generic markdown or JSON scratchpad that becomes the source of truth.
- It is not a user-facing chat that exists only because the runtime needs an internal concept.
- It is not a replacement for sessions, workers, tasks, or jobs.

If Tavern later exposes Cortex health or Cortex actions in the product, that should remain an
inspection surface over the Cortex. It should not redefine the Cortex as a separate conversational
mode.

## Where The Cortex Lives

The Cortex lives inside Tavern.

- The primary agent should have one Cortex.
- Tavern may maintain many Cortices internally when it projects many runtime agents, but normal
  product UI should present the primary agent's Cortex.
- The Cortex should share the same agent boundary as that agent's memories, activity log, task
  state, and projected runtime history.
- The dashboard may inspect Cortex state, but the dashboard does not host the Cortex.
- Connected runtimes may receive memory or tool surfaces from Cortex-produced outputs, but the
  runtime does not become the Cortex.

The Cortex is agent-scoped, not session-scoped. It should survive chat endings, worker exits, and
ordinary runtime restarts as part of Tavern's durable local state.

## Inputs

The Cortex should observe structured runtime systems rather than depend on freeform self-written
files.

Its inputs should include:

- identity context and stable agent configuration
- activity log
- working-memory syntheses and recency state
- durable memory and tiered durable-memory state
- participant metadata and participant summaries when available
- active sessions and relevant projected runtime state
- task, worker, and job state
- cached knowledge synthesis, bulletin state, and dirty flags

The source of truth should remain Tavern's database and typed local stores. The Cortex should use
those systems directly instead of relying on the agent to keep an unstructured heartbeat file in
sync.

## Operating Model

The Cortex should follow a simple repeatable loop:

1. Read current structured state.
2. Check which background responsibilities are due.
3. Run only the due work.
4. Write outputs back into the owning systems.
5. Record important Cortex actions in the activity log.
6. Return to idle.

Most Cortex wake-ups should be cheap due-work checks. Expensive synthesis should only happen when a
real trigger has fired.

## Wake Model

The Cortex should wake on a small set of predictable signals.

- a periodic tick for cheap due-work checks
- day rollover for daily-summary and date-scoped maintenance
- dirty flags when synthesized outputs are known to be stale
- threshold crossings such as enough new events or enough new memory changes
- readiness signals such as queued maintenance

The Cortex should not behave like an always-talking background agent. An idle agent should have an
idle Cortex.

## Responsibilities

The Cortex owns background responsibilities that belong to the agent as a whole rather than to one
live session.

### Memory Context Maintenance

The Cortex should maintain the continuity surfaces that active sessions consume.

- synthesize intraday working-memory blocks from the activity log
- produce daily summaries at day rollover
- regenerate knowledge synthesis when durable memory changed and the debounce window elapsed
- refresh participant summaries when richer participant context exists
- keep the cached bulletin output current as the rendered result of the layered memory-context
  system

The Cortex maintains these outputs so the session can read them cheaply. The session should not
have to regenerate them turn by turn.

### Durable Memory Lifecycle Maintenance

The Cortex should maintain durable memory over time.

- enforce hot-tier limits
- demote hot-tier memories whose hot lifetime has expired
- run graph-tier maintenance such as merge, decay, prune, and supersession handling on the proper
  cadence
- preserve relationships between old and new memories when maintenance changes their status

The Cortex is not the durable memory store. It is the system that keeps that store healthy and
current.

### Recent Activity Maintenance

The Cortex should maintain recent-history compression.

- keep raw activity events available while they are still useful
- roll recent activity into intraday syntheses and then daily summaries
- prune old raw activity once it is safely covered by higher-level recent-history layers
- preserve a coherent recent-history view as days roll over

This keeps the activity log queryable without forcing the prompt-facing recent context to remain a
scrolling event feed forever.

### Persistence Coordination

The Cortex should coordinate the background pass that turns recent signal into durable memory.

- schedule persistence work when explicit boundaries or thresholds are crossed
- ensure persistence runs on the agreed triggers for message count, elapsed active time,
  event-density, or explicit request
- keep memory extraction separate from compaction
- ensure persistence outputs are reflected in both durable memory and the activity log

This makes memory capture an intentional subsystem rather than an accidental side effect of context
pressure.

## Outputs

The Cortex should write into existing Tavern systems rather than invent opaque side channels.

Its outputs may include:

- intraday working-memory syntheses
- daily summaries
- refreshed knowledge synthesis
- refreshed bulletin output
- participant summaries
- durable-memory lifecycle changes
- maintenance outcomes
- activity-log events describing important Cortex behavior

Whenever possible, Cortex outputs should be inspectable from the product surfaces they feed.

## Relationship To Live Sessions

The Cortex and the live session should complement each other.

- The live session handles direct user interaction.
- The live session may still perform on-demand recall or direct reasoning in the moment.
- The Cortex maintains the background continuity surfaces the session can consume cheaply.
- The live session should not duplicate Cortex work on every turn.

This separation matters for latency, token use, and prompt stability. The session gets fresh enough
continuity without paying the full synthesis and maintenance cost every time the user speaks.

## Failure And Recovery

The Cortex should fail softly.

- A Cortex failure must not make live sessions unusable.
- If the Cortex is temporarily unavailable, sessions should continue using the last good cached
  continuity outputs or no extra continuity output at all.
- On restart, the Cortex should resume from structured state and catch up on due work.
- Cortex maintenance should prefer idempotent behavior so retries do not corrupt continuity state.

Tavern should treat Cortex freshness as important, but not as a precondition for basic interaction.

## Product Surfaces

Tavern should expose enough Cortex visibility that operators can understand what it is doing.

- Cortex health should be inspectable.
- Important Cortex actions should appear in the activity log.
- Cortex-produced summaries and syntheses should appear through the memory and recent-history
  surfaces they maintain.
- The memory page may show Cortex-produced bulletin output without exposing the full Cortex as a
  separate user concept.

The product should reveal Cortex effects clearly without making users learn an unnecessary internal
process model.

## Constraints

- The Cortex must remain scoped to one agent.
- The Cortex must prefer structured state over self-authored state files.
- The Cortex must stay mostly idle when nothing changed.
- The Cortex must not create constant synthesis churn.
- The Cortex must not make live sessions responsible for background maintenance.
- The Cortex must remain inspectable enough that operators can understand what it observed, what it
  updated, and why.
