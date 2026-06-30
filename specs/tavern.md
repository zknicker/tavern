# Tavern

Tavern is an always-on agent chat system backed by Tavern Runtime.

## Product Expectations

- Tavern feels like one coherent product around its own product model.
- Tavern Runtime keeps chats, automations, deliveries, and event history alive while the app is
  closed.
- Tavern defines its own product surfaces such as agents, chats, sessions, turns, automations,
  models, memories, and jobs.
- The local agent engine participates in those Tavern surfaces through Runtime
  rather than redefining them.
- The app shell is stable, with a top bar, a persistent left rail, and a main workspace.
- The left rail remains visible across the main product areas rather than disappearing on route
  changes.

## Local-First Behavior

- Tavern App renders the best Runtime-backed state immediately from cache, then reconciles with
  Tavern Runtime.
- Agent execution evidence appears through Tavern Runtime records.
- Runtime records track freshness.
- If a full Runtime sync omits a runtime-native record, Tavern removes that current
  record.
- Agent history such as sessions, transcripts, logs, and run events remains useful as
  evidence and is not deleted merely because a later sync does not mention it.

## Config And Runtime Facts

- Tavern Runtime owns shared services such as chat, memory, automations, delivery, jobs,
  model routing, provider state, executable agent settings, sessions, turns, transcripts,
  logs, tools, and agent files.
- Tavern App owns first-party client presentation, cache, and app-shell preferences.
- Tavern stores what happened during agent execution as Runtime evidence.

## Runtime Relationship

- The local agent engine is managed inside Tavern Runtime.
- Agent-engine behavior maps cleanly into Tavern's named primitives rather than redefining them.
- Tavern Runtime manages the supported local product path; Tavern App is only a client.
