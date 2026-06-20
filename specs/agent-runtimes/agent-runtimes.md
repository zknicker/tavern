# Hermes Runtime

Tavern Runtime manages one local Hermes install and presents Hermes-native state through
Tavern primitives.

## Model

- Hermes owns agent execution.
- Tavern Runtime owns the generated Hermes config policy and applies a full managed config to
  Hermes.
- Tavern Runtime owns canonical chats, messages, events, reads, automations, deliveries, memory,
  generated config inputs, sync status, and Runtime-specific metadata.
- Hermes owns native agent execution, sessions, turns, transcripts, logs, skills, agent files,
  applied model/runtime config, platform channels, and runtime settings.
- Tavern App owns client cache, presentation state, and app settings.
- Tavern Runtime installs, starts, supervises, upgrades, and launches Hermes with Seatbelt
  guardrails.
- Tavern does not require users to configure Hermes through native files or CLIs.

## Runtime Identity

- Tavern has one managed runtime namespace: `tavern-hermes-managed`.
- The namespace is stable across Hermes reinstall, Hermes runtime-state reset, and version
  upgrade.
- Synced runtime tables may keep a `runtime_id` column for scoping and forward compatibility, but
  product behavior must treat it as the stable managed Hermes namespace, not as a selectable
  runtime list.
- Tavern Runtime endpoint can be offline while previously synced records remain visible.

## Synced Records

- Tavern stores local records for Hermes primitives.
- Synced rows use stable Hermes identifiers and the stable `tavern-hermes-managed`
  namespace.
- Synced rows include `last_synced_at`.
- On boot, reconnect, scheduled sync, and Gateway events, Tavern refreshes affected records.
- For full authoritative Hermes snapshots, Tavern accepts Hermes deletion and removes matching
  synced rows.
- For observed message history, Tavern upserts by stable identifier and reconciles deletions only
  inside the timestamp window returned by the Gateway fetch.
- Deleting `~/.tavern/runtime/hermes/run` must not delete archived records from the Tavern
  database. Runtime recreates Hermes state and config, then sync refreshes current rows while
  archived sessions/messages remain available.

## Edits

- Editing Hermes config in Tavern updates Tavern-owned config state.
- Tavern Runtime regenerates/applies managed Hermes config from that state.
- Hermes-native config edits outside Tavern are not part of the supported product model and may
  be overwritten by Runtime.
- Hermes-originated runtime events notify Tavern through Gateway events and targeted sync.
- Tavern-owned fields on local records, such as visual color, remain local Tavern state.

## Platforms

- Platforms such as Discord, Telegram, iMessage, and Slack are transport concepts under Hermes.
- The Hermes adapter normalizes platform-specific payloads into Tavern primitives before data
  reaches Tavern product code.
- Platform-specific parsing belongs inside the Hermes adapter, such as the Discord platform
  module.
- Tavern product code works with normalized chats, sessions, messages, agents, and participants. It
  does not parse Hermes session keys or platform-native payload fragments.

## Events

- Hermes Gateway exposes a live WebSocket event stream.
- Events identify the affected primitive.
- Events are invalidation and freshness signals, not the only source of durable history.
- Tavern refreshes affected records over Gateway RPC after config and history events when a
  complete payload is not included.
