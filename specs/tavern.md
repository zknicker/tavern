# Tavern

Tavern is an always-on agent chat system backed by Tavern Runtime.

## Product Expectations

- Tavern feels like one coherent product around its own product model.
- Tavern Runtime keeps chats, automations, deliveries, and event history alive while the app is
  closed.
- Tavern defines its own product surfaces such as agents, chats, sessions, turns, automations,
  models, memories, and jobs.
- OpenClaw participates in those Tavern surfaces rather than redefining them.
- The app shell is stable, with a top bar, a persistent left rail, and a main workspace.
- The left rail remains visible across the main product areas rather than disappearing on route
  changes.

## Local-First Behavior

- Tavern App renders the best Runtime-backed state immediately from cache, then reconciles with
  Tavern Runtime.
- OpenClaw-owned config and execution evidence appears through Runtime projections.
- Runtime projections record freshness.
- If a full OpenClaw config snapshot omits an OpenClaw-owned record, Tavern removes that projected
  record.
- OpenClaw-owned history such as sessions, transcripts, logs, and run events remains useful as
  evidence and is not deleted merely because a later sync does not mention it.

## Config And Runtime Facts

- Tavern Runtime owns shared services such as chat, memory, automations, delivery, and jobs.
- Tavern App owns first-party client settings and presentation.
- OpenClaw-native records such as sessions, turns, transcripts, logs, tools, and agent files live
  in OpenClaw.
- Tavern separately observes and stores what happened in OpenClaw as execution evidence.

## Runtime Relationship

- OpenClaw is the managed execution layer connected to Tavern Runtime.
- OpenClaw behavior maps cleanly into Tavern's named primitives rather than redefining them.
- Tavern Runtime manages OpenClaw Gateway for the supported local product path.
