# OpenClaw Runtime

Tavern Runtime manages one local OpenClaw install and presents OpenClaw-native state through
Tavern primitives.

## Model

- OpenClaw owns agent execution.
- Tavern Runtime owns the generated OpenClaw config policy and applies a full managed config to
  OpenClaw.
- OpenClaw owns native cron jobs, sessions, messages, logs, skills, agent files,
  applied model/runtime config, platform channels, and runtime settings.
- Tavern owns app chats, memory, tasks, local projections, sync status, generated config inputs,
  and Tavern-specific presentation metadata.
- Tavern Runtime installs, starts, supervises, upgrades, and launches OpenClaw with Seatbelt
  guardrails.
- Tavern does not require users to configure OpenClaw through native files or CLIs.

## Runtime Identity

- Tavern has one managed runtime namespace: `tavern-openclaw-managed`.
- The namespace is stable across OpenClaw reinstall, OpenClaw runtime-state reset, and version
  upgrade.
- Projection tables may continue to store a `runtime_id` column for scoping and future-proofing, but
  product behavior must treat it as the stable managed OpenClaw namespace, not as a selectable
  runtime list.
- Tavern Runtime endpoint can be offline while previously synced projections remain visible.

## Projections

- Tavern stores local projections of OpenClaw-owned primitives.
- Projection rows use stable OpenClaw identifiers and the stable `tavern-openclaw-managed`
  namespace.
- Projection rows include `last_synced_at`.
- On boot, reconnect, scheduled sync, and Gateway events, Tavern refreshes affected projections.
- For full authoritative OpenClaw snapshots, Tavern accepts OpenClaw deletion and removes matching
  projection rows.
- For observed message history, Tavern upserts by stable identifier and reconciles deletions only
  inside the timestamp window returned by the Gateway fetch.
- Deleting `~/.tavern/runtime/openclaw/run` must not delete archived projections from the Tavern
  database. Runtime recreates OpenClaw state and config, then sync refreshes current rows while
  archived sessions/messages remain available.

## Edits

- Editing OpenClaw-owned config in Tavern updates Tavern-owned config state.
- Tavern Runtime regenerates/applies managed OpenClaw config from that state.
- OpenClaw-native config edits outside Tavern are not part of the supported product model and may
  be overwritten by Runtime.
- OpenClaw-originated runtime events notify Tavern through Gateway events and targeted sync.
- Tavern-owned fields on projected records, such as visual color and avatar presentation, remain
  local Tavern state.

## Platforms

- Platforms such as Discord, Telegram, iMessage, and Slack are transport concepts under OpenClaw.
- The OpenClaw adapter normalizes platform-specific payloads into Tavern primitives before data
  reaches Tavern product code.
- Platform-specific parsing belongs inside the OpenClaw adapter, such as the Discord platform
  module.
- Tavern product code works with normalized chats, sessions, messages, agents, and participants. It
  should not parse OpenClaw session keys or platform-native payload fragments.

## Events

- OpenClaw Gateway exposes a live WebSocket event stream.
- Events identify the affected primitive.
- Events are invalidation and freshness signals, not the only source of durable history.
- Tavern refreshes affected records over Gateway RPC after config and history events when a
  complete payload is not included.
