# Specs

This tree is the normative product model for Tavern. Specs describe the product contract, not
bug history or stale plans.

Tavern is an always-on agent chat system backed by Tavern Runtime. Tavern Runtime owns canonical
chats, messages, responses, activity, artifacts, participants, event cursors, automations,
deliveries, Vault, generated instruction policy, executable agent settings, native agent
execution, sessions, turns, transcripts, files, tools, model routing, provider state, platform
bindings, prompt-time memory, and jobs. Tavern App owns the first-party Mac client, cache,
presentation metadata, and app-shell preferences.

Tavern currently supports one local agent engine implementation inside Runtime.
`packages/tavern-api` is the cross-boundary contract so product APIs stay stable and do not mirror
agent-engine implementation choices directly.

## Rules

- Write specs in present tense.
- Use Tavern product nouns: `agent`, `chat`, `message`, `response`, `activity`, `artifact`,
  `session`, `cron`, `participant`, `job`.
- Keep obsolete migration history and research notes out of `specs/`. Durable architecture specs
  can include migration phases and open questions while a design is in flight.
- Update `packages/tavern-api` when a cross-boundary first-party contract changes.
- Keep Runtime-specific behavior in `agent-runtimes/` or agent-engine docs.

## Core Specs

- `tavern.md`: product relationship between Tavern App, Tavern Runtime, and the local agent engine.
- `runtime-chat-server.md`: always-on runtime-owned chat server design.
- `runtime-boundary.md`: ownership boundaries and runtime expectations.
- `sync-model.md`: runtime mapping, freshness, deletion, edit, event, and job behavior.
- `agents.md`, `chats.md`, `sessions.md`, `messages.md`, `cron.md`: core runtime-owned
  primitives as Tavern presents them.
- `participants.md`: observed participants, labels, and self actor presentation.
- `mentions.md`: `@` references in composers, their metadata, and their runtime effects.
- `jobs.md`, `workers.md`, `models.md`, `skills.md`, `tools.md`, `catalog.md`, `activity-log.md`:
  focused product surfaces.
- `clarifications.md`: mid-turn questions, skip/timeout answers, and runtime
  response wiring.
- `mcp.md`: advanced MCP server records for Runtime and Plugin-backed
  integration plumbing.
- `permissions.md`: tool sources, sandbox mode, approval policy, and command
  allowlist.
- `workspace.md`: the generated `AGENTS.md` artifact and its editable
  sources (`NOTES.md`, `SOUL.md`).
- `tavern-skill.md`: the agent's product knowledge of and operational access
  to Tavern.

## Memory Specs

- `memories.md`: Vault durable knowledge, person memory, and memory
  inspection surfaces.
- `memory-context.md`: bounded prompt-facing context assembled from Runtime
  context management, chat state, participants, and selected wiki material.
- `memory-lifecycle.md`: Vault lifecycle, correction, forgetting, and
  maintenance through Tasks and crons.
- `memory-persistence.md`: historical memory persistence design; do not extend
  it for new wiki work.
- `participant-knowledge.md`: participant identity resolution and person-level
  knowledge.

## Vault Specs

- `vault.md`: Vault-backed durable knowledge browser and Runtime contract.

## Runtime Specs

- `../docs/internals/runtime.md`: Tavern Runtime ownership and sync flow.
- `agent-runtimes/README.md`: agent runtime spec index.
- `agent-runtimes/agent-runtimes.md`: local agent runtime model.
- `agent-runtimes/agents.md`, `agent-runtimes/chats.md`, `agent-runtimes/sessions.md`,
  `agent-runtimes/security.md`: focused runtime-facing expectations.
