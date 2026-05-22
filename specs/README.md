# Specs

This tree is the normative product model for Tavern. Specs describe the product contract, not
bug history or stale plans.

Tavern is an always-on agent chat system backed by Tavern Runtime. Tavern Runtime owns canonical
chats, messages, responses, activity, artifacts, participants, event cursors, automations,
deliveries, Cortex, generated config policy, and jobs. Tavern App owns the first-party Mac client,
cache, presentation metadata, profiles, participant links, and app settings. OpenClaw owns native
agent execution, sessions, turns, transcripts, files, tools, applied model/runtime config, platform
bindings, and prompt-time memory.

Tavern currently supports one runtime product: OpenClaw. `packages/tavern-api` is the
cross-boundary contract so product APIs stay stable and do not mirror OpenClaw design choices
directly.

## Rules

- Write specs in present tense.
- Use Tavern product nouns: `agent`, `chat`, `message`, `response`, `activity`, `artifact`,
  `session`, `cron`, `participant`, `job`.
- Keep obsolete migration history and research notes out of `specs/`. Durable architecture specs
  can include migration phases and open questions while a design is in flight.
- Update `packages/tavern-api` when a cross-boundary first-party contract changes.
- Keep runtime-specific behavior in `agent-runtimes/` or adapter package docs.

## Core Specs

- `tavern.md`: product relationship between Tavern, Tavern Runtime, and OpenClaw.
- `runtime-chat-server.md`: always-on runtime-owned chat server design.
- `integration-boundary.md`: ownership boundaries and runtime expectations.
- `sync-model.md`: runtime mapping, freshness, deletion, edit, event, and job behavior.
- `agents.md`, `chats.md`, `sessions.md`, `messages.md`, `cron.md`: core runtime-owned
  primitives as Tavern presents them.
- `participants.md`: profiles, participants, labels, and manual profile links.
- `mentions.md`: `@` references in composers, their metadata, and their runtime effects.
- `jobs.md`, `workers.md`, `models.md`, `skills.md`, `tools.md`, `catalog.md`, `activity-log.md`:
  focused product surfaces.
- `workspace.md`: managed OpenClaw workspace instructions, generated
  `AGENTS.md`, agent soul, and agent notes.

## Memory Specs

- `memories.md`: Cortex-backed durable memory, person memory, and memory
  inspection surfaces.
- `memory-context.md`: bounded prompt-facing context assembled from Lossless
  Claw context management, chat state, participants, and Cortex recall.
- `memory-lifecycle.md`: Cortex page lifecycle, recall behavior, correction,
  forgetting, and maintenance.
- `memory-persistence.md`: Cortex capture, watermarks, and extraction pipeline.
- `participant-knowledge.md`: participant/profile resolution and person-level
  knowledge.

## Cortex Specs

- `cortex.md`: GBrain-style durable brain with pages, compiled truth, timelines,
  chunks, embeddings, links, files, citations, recall, capture, maintenance,
  and product surfaces.

## Runtime Specs

- `../docs/internals/runtime.md`: Tavern Runtime ownership and sync flow.
- `../docs/operations/openclaw-runtime-upgrade.md`: managed OpenClaw version bump and state
  migration process.
- `agent-runtimes/README.md`: OpenClaw runtime spec index.
- `agent-runtimes/agent-runtimes.md`: OpenClaw runtime model.
- `agent-runtimes/openclaw-gateway.md`: implemented OpenClaw Gateway adapter contract.
- `agent-runtimes/agents.md`, `agent-runtimes/chats.md`, `agent-runtimes/sessions.md`,
  `agent-runtimes/security.md`: focused runtime-facing expectations.
