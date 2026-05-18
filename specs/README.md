# Specs

This tree is the normative product model for Tavern. Specs describe the product contract, not
bug history or stale plans.

Tavern is an always-on agent chat system backed by Tavern Runtime. Tavern Runtime owns canonical
chats, messages, participants, event cursors, automations, deliveries, memory, knowledge/task
systems, generated config policy, and jobs. Tavern App owns the first-party Mac client, cache,
presentation metadata, profiles, participant links, and app settings. OpenClaw owns native agent
execution, sessions, turns, transcripts, files, tools, applied model/runtime config, and platform
bindings.

Tavern currently supports one runtime product: OpenClaw. `packages/tavern-api` is the
cross-boundary contract so product APIs stay stable and do not mirror OpenClaw design choices
directly.

## Rules

- Write specs in present tense.
- Use Tavern product nouns: `agent`, `chat`, `session`, `turn`, `cron`, `participant`, `job`.
- Keep obsolete migration history and research notes out of `specs/`. Durable architecture specs
  can include migration phases and open questions while a design is in flight.
- Update `packages/tavern-api` when a cross-boundary first-party contract changes.
- Keep runtime-specific behavior in `agent-runtimes/` or adapter package docs.

## Core Specs

- `tavern.md`: product relationship between Tavern, Tavern Runtime, and OpenClaw.
- `runtime-chat-server.md`: always-on runtime-owned chat server design.
- `integration-boundary.md`: ownership boundaries and runtime expectations.
- `sync-model.md`: projection, freshness, deletion, edit, event, and job behavior.
- `agents.md`, `chats.md`, `sessions.md`, `messages.md`, `cron.md`: core runtime-owned
  primitives as Tavern presents them.
- `participants.md`: profiles, participants, labels, and manual profile links.
- `jobs.md`, `workers.md`, `models.md`, `skills.md`, `tools.md`, `catalog.md`, `activity-log.md`:
  focused product surfaces.

## Memory Specs

- `memories.md`
- `memory-context.md`
- `memory-lifecycle.md`
- `memory-persistence.md`
- `participant-knowledge.md`
- `cortex.md`

## Runtime Specs

- `../docs/internals/runtime.md`: Tavern Runtime ownership and sync flow.
- `../docs/operations/openclaw-runtime-upgrade.md`: managed OpenClaw version bump and state
  migration process.
- `agent-runtimes/README.md`: OpenClaw runtime spec index.
- `agent-runtimes/agent-runtimes.md`: OpenClaw runtime model.
- `agent-runtimes/openclaw-gateway.md`: implemented OpenClaw Gateway adapter contract.
- `agent-runtimes/agents.md`, `agent-runtimes/chats.md`, `agent-runtimes/sessions.md`,
  `agent-runtimes/security.md`: focused runtime-facing expectations.
