# Specs

This tree is the normative product model for Tavern. Specs describe the current target shape, not
migration notes or historical plans.

Tavern is an OpenClaw dashboard, agent homebase, and utility layer backed by Tavern Runtime. Tavern
owns memory, knowledge/task systems, local projections, sync state, profiles, participant links,
presentation metadata, generated config policy, and jobs. OpenClaw owns native execution, agents,
cron jobs, sessions, messages, files, skills, tools, applied model/runtime config, and platform
bindings.

Tavern currently supports one runtime product: OpenClaw. Tavern still keeps Tavern-owned runtime
primitives and the `packages/agent-runtime-protocol` boundary so product APIs stay stable and do
not mirror OpenClaw design choices directly.

## Rules

- Write specs in present tense.
- Use Tavern product nouns: `agent`, `chat`, `session`, `turn`, `cron`, `participant`, `job`.
- Keep migration history, research notes, and obsolete implementation plans out of `specs/`.
- Update `packages/agent-runtime-protocol` when the first-party runtime contract changes.
- Keep runtime-specific behavior in `agent-runtimes/` or adapter package docs.

## Core Specs

- `tavern.md`: product relationship between Tavern, Tavern Runtime, and OpenClaw.
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

- `../docs/runtime.md`: Tavern Runtime ownership and sync flow.
- `../docs/openclaw-runtime-upgrade.md`: managed OpenClaw version bump and state migration process.
- `agent-runtimes/README.md`: OpenClaw runtime spec index.
- `agent-runtimes/agent-runtimes.md`: OpenClaw runtime model.
- `agent-runtimes/openclaw-gateway.md`: implemented OpenClaw Gateway adapter contract.
- `agent-runtimes/agents.md`, `agent-runtimes/chats.md`, `agent-runtimes/sessions.md`,
  `agent-runtimes/security.md`: focused runtime-facing expectations.
