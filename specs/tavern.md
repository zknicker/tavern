# Tavern

Tavern is an OpenClaw dashboard, agent homebase, and utility layer backed by Tavern Runtime.

## Product Expectations

- Tavern should feel like one coherent product around its own product model.
- Tavern should define its own product surfaces such as agents, chats, sessions, cron, models,
  memories, and jobs.
- OpenClaw should support those Tavern surfaces rather than redefine them.
- The app shell should feel stable, with a top bar, a persistent left rail, and a main workspace.
- The left rail should remain visible across the main product areas rather than disappearing on
  route changes.

## Local-First Behavior

- Tavern should render Tavern-owned local state immediately.
- OpenClaw-owned config state such as agents and cron jobs appears from synced Tavern projections.
- Config projections are refreshed from OpenClaw and record `last_synced_at`.
- If a full OpenClaw config snapshot omits a record, Tavern removes that projected record.
- OpenClaw-owned history such as chats, sessions, messages, logs, and run events remains useful as
  an archive and is not deleted merely because a later sync does not mention it.

## Config And Runtime Facts

- Tavern should own shared services such as memory and local app settings.
- OpenClaw-native records such as agents, cron jobs, sessions, and logs should live in OpenClaw.
- Tavern should separately observe and store what happened in OpenClaw.

## Runtime Relationship

- OpenClaw is the external execution layer connected to Tavern.
- OpenClaw behavior should map cleanly into Tavern's named primitives rather than redefining them.
- Connecting Tavern to OpenClaw Gateway should be a normal product flow in settings.
