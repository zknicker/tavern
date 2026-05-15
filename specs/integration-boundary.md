# Integration Boundary

Tavern owns the product surfaces it presents, even when connected runtimes own the underlying
execution state.

## Product Ownership

- Tavern defines its own nouns such as agents, chats, sessions, turns, cron, events, memories,
  models, jobs, skills, and tools.
- Tavern should avoid leaking runtime-specific product language into its primary UI when an Tavern
  noun already exists.
- Tavern should preserve its own distinction between chats, sessions, and turns even if a runtime
  exposes those concepts differently.
- Ownership is per domain.
- Tavern-owned domains include memory, app settings, runtime health, sync state, jobs, and
  presentation overlays.
- Runtime-owned domains include native agent config, cron config, execution sessions, messages,
  logs, skills, tools, model routing, channel bindings, and provider secrets unless a runtime
  explicitly delegates a domain to Tavern.

## Runtime Expectations

- Tavern maps runtime data into Tavern product behavior and terminology.
- Tavern edits runtime-owned config through supported runtime APIs or plugins.
- Tavern does not maintain duplicate canonical records for runtime-owned config.
- Runtime-native edits remain valid and refresh Tavern through sync and events.
- Periodic sync is for projections and observed history, not for taking ownership away from the
  runtime.

## Tavern Expectations

- Tavern stays useful when a runtime is offline by rendering already synced projections and
  observed history.
- Tavern should identify which runtime owns each projected primitive.
- Tavern should make sync freshness and failures visible without exposing raw runtime internals.
