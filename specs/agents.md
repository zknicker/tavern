# Agents

Tavern presents one primary OpenClaw-backed agent that it observes, presents, and can configure
through OpenClaw. Runtime adapters may still project multiple OpenClaw agents, but normal product
surfaces should resolve the primary agent instead of asking the person to choose among agents.

## Product Expectations

- An agent has a stable OpenClaw identity.
- An agent has a user-facing name.
- An agent should feel like the same worker wherever Tavern presents it.
- An agent should remain visible in Tavern when OpenClaw is offline if Tavern has already synced
  it.
- An agent is not a session, turn, worker process, or tool call.
- Product-facing navigation, chat start, cron setup, skills, model settings, and messaging
  bindings should presume one primary agent.
- Plural agent lists are runtime/internal projection surfaces, not normal product navigation.

## Ownership

- OpenClaw is canonical for execution config.
- OpenClaw-owned agent config may include name, model route, tool policy, skill enablement,
  workspace, and persisted identity documents such as `SOUL.md`, `IDENTITY.md`, and `ROLE.md`.
- Tavern exposes OpenClaw's per-agent `thinkingDefault` as the model effort setting. The allowed
  values come from the selected OpenClaw harness and model profile. OpenClaw's `reasoningDefault`
  controls reasoning visibility, not effort.
- Tavern reads and writes OpenClaw-owned agent config through OpenClaw Gateway.
- Tavern does not keep a competing canonical agent config store.
- Tavern may keep local presentation overlays such as color, avatar style, pinned state, and local
  notes.
- OpenClaw-native edits made outside Tavern refresh Tavern through sync and events.

## Relationships

- An agent belongs to the managed OpenClaw runtime namespace.
- An agent may participate in many chats.
- An agent may run many sessions.
- An agent may own many turns and workers.
- An agent may author many messages and tool interactions.
- Tavern currently selects one primary projected agent for user-facing flows. Future multi-agent
  support should introduce explicit product behavior rather than leaking runtime lists into the UI.

## Lifecycle

- Creating, editing, or deleting an OpenClaw-owned agent in Tavern acts on OpenClaw when the Gateway
  supports that operation.
- If OpenClaw reports an agent removed from an authoritative agent snapshot, Tavern removes the
  projected agent row.
- Tavern-owned overlays may remain available for reuse only when they are not represented as a live
  OpenClaw agent.
