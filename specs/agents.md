# Agents

Tavern presents one primary Hermes-backed agent that it observes, presents, and can configure
through Hermes. Runtime adapters may still expose multiple Hermes agents, but normal product
surfaces resolve the primary agent instead of asking the person to choose among agents.

## Product Expectations

- An agent has a stable Hermes identity.
- An agent has a user-facing name.
- An agent feels like the same worker wherever Tavern presents it.
- An agent remains visible in Tavern when Hermes is offline if Tavern has already synced
  it.
- An agent is not a session, turn, worker process, or tool call.
- Product-facing navigation, chat start, cron setup, skills, model settings, and messaging
  bindings presume one primary agent.
- Plural agent lists are runtime/internal surfaces, not normal product navigation.

## Ownership

- Hermes is canonical for execution config.
- Hermes agent config may include name, model route, tool policy, skill enablement,
  workspace, `AGENTS.md` workspace context, and `SOUL.md` identity.
- Tavern exposes Hermes's per-agent `thinkingDefault` as the model effort setting. The allowed
  values are the Hermes effort enum: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`,
  `adaptive`, and `max`.
- Tavern keeps the managed agent on Hermes's default runtime. Codex app-server runtime is a
  Hermes opt-in through `model.openai_runtime: codex_app_server`, not a Tavern model-provider
  inference.
- Tavern reads and writes Hermes agent config through Hermes Gateway.
- Tavern does not keep a competing canonical agent config store.
- Tavern may keep local presentation overlays such as color, pinned state, and local
  notes.
- Tavern exposes agent display name and color as editable agent settings on the agent record.
- Tavern exposes subagent defaults — the model and effort used for delegated work — as agent-level
  settings materialized through generated managed runtime config.
- Tavern exposes the agent timezone as a Runtime-stored execution setting (system default when
  unset) materialized through generated managed runtime config; it governs schedules and
  time-aware answers.
- Hermes-native edits made outside Tavern refresh Tavern through sync and events.

## Relationships

- An agent belongs to the managed Hermes runtime namespace.
- An agent may participate in many chats.
- An agent may run many sessions.
- An agent may own many turns and workers.
- An agent may author many messages and tool interactions.
- Tavern selects one primary agent for user-facing flows. Multi-agent support uses
  explicit product behavior rather than leaking runtime lists into the UI.

## Lifecycle

- Creating, editing, or deleting an Hermes agent in Tavern acts on Hermes when the Gateway
  supports that operation.
- If Hermes reports an agent removed from an authoritative agent snapshot, Tavern removes the
  current agent row.
- Tavern-owned overlays may remain available for reuse only when they are not represented as a live
  Hermes agent.
