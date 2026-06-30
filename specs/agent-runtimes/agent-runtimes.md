# Agent Runtime

Tavern Runtime manages one local agent runtime namespace and presents execution
state through Tavern primitives.

## Model

- Tavern Runtime owns local agent execution.
- Tavern Runtime owns canonical chats, messages, events, reads, automations,
  deliveries, Memory, generated instruction inputs, sync status, and
  Runtime-specific metadata.
- Tavern Runtime owns provider availability, model catalog, selected model,
  executable settings, sessions, turns, tool calls, and response activity.
- AI SDK providers own model calls. Codex and Claude use local OAuth-backed CLI
  providers; OpenAI uses API-key-backed local `LanguageModel` instances.
- Tavern App owns client cache, presentation state, and app-shell preferences.
- Tavern does not require users to configure the internal engine dependency
  through native files or CLIs.

## Runtime Identity

- Tavern has one managed runtime namespace: `tavern-agent-engine`.
- The namespace is stable across Runtime restarts and runtime-state resets.
- Synced runtime tables may keep a `runtime_id` column for scoping and forward
  compatibility, but product behavior must treat it as the stable agent runtime
  namespace, not as a selectable runtime list.
- The Tavern Runtime endpoint can be offline while previously synced records
  remain visible.

## Synced Records

- Tavern stores local records for Runtime primitives.
- Synced rows use stable Runtime identifiers and the stable
  `tavern-agent-engine` namespace.
- Synced rows include `last_synced_at`.
- On boot, reconnect, scheduled sync, and runtime events, Tavern refreshes
  affected records.

## Edits

- Editing agent settings in Tavern calls Runtime APIs and updates Runtime-owned
  executable settings state.
- Runtime applies supported settings to the local turn runner.
- Unsupported execution knobs are not exposed as settings.
- Runtime-originated events notify Tavern through targeted sync.
- Tavern-owned fields on local records, such as visual color, remain local
  Tavern state.
