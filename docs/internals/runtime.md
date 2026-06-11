---
summary: Tavern Runtime internals for canonical chat storage, managed Hermes startup, adapter projection, persistence, ingestion paths, and tool boundaries.
read_when:
  - changing the always-on chat server, managed Hermes startup, or runtime ownership
  - changing ingestion paths, execution evidence, managed workspace instructions, or agent-facing Tavern tools
---

# Tavern Runtime

Tavern Runtime is the local always-on server. It owns canonical chat history and
local integration. It is not the product UI and it is not a replacement agent
executor.

## Ownership

* **Tavern Runtime owns chat and local integration.** It stores canonical chats,
  messages, participants, events, reads, automations, agents, and delivery
  state. It starts managed Hermes, carries runtime events, stores runtime
  settings, exposes Cortex wiki reads, and exposes Tavern tools to agents.
* **Hermes owns execution.** Sessions, turns, messages, tools, model calls, and
  native Hermes runtime behavior remain Hermes-owned. Tavern stores projected
  execution evidence only where the product needs durable chat, activity,
  artifact, or recovery state.
* **The Hermes adapter is transport only.** Runtime creates chats, binds chats
  to agents and session keys, writes durable Tavern messages, and then dispatches
  accepted work through the adapter. The adapter references existing Runtime chat
  and message ids; it does not create chats, repair chats, or write chat-level
  Tavern metadata.
* **Tavern App owns presentation.** The app reads runtime chat history, caches
  what it needs, and renders chats, activity, settings, memory inspection, the
  Cortex wiki, automations, skills, and stats.
* **Events are recoverable notifications.** Runtime chat events are durable and
  cursor-backed. Hermes stream events trigger focused ingestion paths; they are
  not durable chat history by themselves.

## Managed Hermes

Local development starts the full stack with:

```bash
bun run dev
```

That launches Tavern Runtime, managed Hermes, the app backend, and the website
dev server. Runtime runs `hermes dashboard --no-open` and stores managed Hermes
state under the dev stack's worktree-isolated Runtime root by default.

Runtime owns the Hermes engine binary, not just its lifecycle: it resolves an
explicit `TAVERN_HERMES_BIN`, then a pinned managed engine under
`~/.tavern/engine/<pin>/`, then (only with `TAVERN_HERMES_ALLOW_SYSTEM`) a system
install, and bootstraps the pinned engine when none is found. Production runs the
pinned engine and ignores a host's own Hermes; the dev stack opts into the system
install. See [Managed Hermes Runtime](../operations/hermes-managed-runtime.md) for
the resolution tiers, flags, and the sandboxed installer.

Key paths:

```txt
~/.tavern/dev/<worktree-id>/runtime/data/runtime.db
~/.tavern/dev/<worktree-id>/runtime/hermes/home/
```

The dev stack derives a stable port group from the worktree path and passes the
same `TAVERN_RUNTIME_PORT`, `TAVERN_RUNTIME_URL`, and `TAVERN_HERMES_PORT` to
Runtime, server, website, and desktop. Use `TAVERN_DEV_STACK_ID`,
`TAVERN_DEV_PORT_BASE`, `TAVERN_RUNTIME_ROOT`, `TAVERN_HERMES_HOME`,
`TAVERN_HERMES_BIN`, `TAVERN_HERMES_HOST`, `TAVERN_HERMES_PORT`, and
`TAVERN_HERMES_TOKEN` to isolate or point a local run at a specific Hermes
process. Runtime marks Hermes ready only after the dashboard HTTP status route
responds and `/api/ws` accepts a WebSocket connection.

## Managed Workspace

Runtime exposes the Hermes-supported markdown files as agent files. `AGENTS.md`
lives in the managed Hermes workspace and carries project/workspace context.
`SOUL.md` lives in the managed Hermes home and carries identity, voice, and
personality.

`AGENTS.md` starts with a marker-delimited, hash-versioned Tavern-managed block
(`apps/runtime/src/workspace/managed-instructions.ts`). Runtime reconciles the
block during agent sync, after `AGENTS.md` saves through the agent file API,
and before each turn dispatch: a missing file is seeded, a stale block is
replaced in place, missing markers re-insert the block at the top, and all
content outside the markers is preserved byte-for-byte. Users edit the file in settings and the
agent edits it with file tools; both edit outside the managed block. Runtime
never writes `SOUL.md`. See [workspace.md](../../specs/workspace.md) for the
contract.

When a reconcile writes the file, Runtime also clears unsupported legacy
companion bootstrap files from the managed workspace. It does not clear
`SOUL.md`.

The agent's operational access to Tavern ships as the managed `tavern` skill
(`apps/runtime/src/hermes/tavern-skill.ts`): chat reads and searches, attributed
deliveries into chats, read-only self-configuration lookups, and the settings
map, all over the local Runtime API. The managed block points the agent at the
skill; [tavern-skill.md](../../specs/tavern-skill.md) is the contract.

## Persistence

The Runtime root is the backup unit. It defaults to
`~/.tavern/runtime` and contains Tavern's runtime chat database, Cortex,
vault, managed skills, runtime settings, generated Hermes home/workspace, and
projected Hermes execution evidence. The dev stack uses
`~/.tavern/dev/<worktree-id>/runtime` by default.

Tavern Runtime chat records are canonical. Hermes-owned execution records
that Tavern renders, inspects, searches, or recovers are persisted in Tavern
Runtime storage as execution evidence. Hermes remains canonical for native
execution behavior.

Cortex is a Runtime read surface over the user's llm-wiki hub. Hermes context
management for turns remains separate from durable wiki knowledge. Tavern
reports wiki hub readiness separately from prompt-time context management.

Memory and Cortex product contracts live in [Memories](../../specs/memories.md)
and [Cortex](../../specs/cortex.md).

## Runtime Ingestion

Hermes execution enters Tavern through Runtime ingestion paths. App-facing
queries read Tavern Runtime storage; they do not reach around Runtime to
Hermes. Runtime-ready sync avoids Hermes reference catalogs such as skills,
models, and session indexes. Skill and model surfaces return the latest stored
snapshot immediately and refresh in the background when the snapshot is missing
or stale. The skill inventory refresh runs on startup, every 15 minutes, and
after skill-related writes; it emits a skill update event only when stored
inventory changes. Hermes events update the active turn, response activity, and
durable assistant delivery. Session index surfaces use bounded Runtime previews.
Session inspection uses a bounded recent history window.

| Source | Tavern stores |
| --- | --- |
| agent API and events | agent records and activity |
| session events | session records and freshness notifications |
| transcript messages | message and tool-call evidence linked to Tavern chats |
| automation events | automation runs, delivery state, and related session evidence |

Provider usage imports and other scheduled operational tasks use Runtime jobs.
Runtime jobs run through Bunqueue, store run metadata in `runtime_job_runs`, and
expose list, detail, and manual-run routes under `/jobs` so the app can audit
background work without recreating job status from domain status endpoints.
Routine agent, chat, session, cron, and config freshness comes from writes and
events that update Tavern Runtime storage directly.

Runtime-owned capability checks live in
[runtime-capabilities.md](runtime-capabilities.md). Runtime stores capability
health and exposes it through the Admin API. Jobs and app surfaces can use
capability health to decide whether dependent functionality is available. The
app renders capability health; it does not own Runtime capability checks.

Cortex wiki maintenance does not sync from Hermes. Agents perform llm-wiki
maintenance through Tasks and Runtime crons.

## Boundaries

* App backend ownership: [app.md](app.md)
* Chat API contract: [../api/chat.md](../api/chat.md)
* Testing and verification: [../operations/testing.md](../operations/testing.md)
