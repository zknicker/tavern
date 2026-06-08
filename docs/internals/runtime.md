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
  settings, owns Cortex storage, and exposes Tavern tools to agents.
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

Key paths:

```txt
~/.tavern-hermes/dev/<worktree-id>/runtime/data/runtime.db
~/.tavern-hermes/dev/<worktree-id>/runtime/cortex/cortex.pglite
~/.tavern-hermes/dev/<worktree-id>/runtime/hermes/home/
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

Runtime writes a generated `AGENTS.md` into the managed Hermes workspace. The
file combines Tavern-managed instructions, the user's agent instructions block,
and agent-authored notes stored by Tavern.

Runtime clears legacy companion bootstrap files from the managed workspace
before rendering `AGENTS.md`.

Agents update their notes through Tavern workspace tools instead of editing
`AGENTS.md` directly. Runtime regenerates the file on boot, config sync, and
instruction source changes.

## Persistence

The Runtime root is the backup unit. It defaults to
`~/.tavern-hermes/runtime` and contains Tavern's runtime chat database, Cortex,
vault, managed skills, runtime settings, generated Hermes home/workspace, and
projected Hermes execution evidence. The dev stack uses
`~/.tavern-hermes/dev/<worktree-id>/runtime` by default.

Tavern Runtime chat records are canonical. Hermes-owned execution records
that Tavern renders, inspects, searches, or recovers are persisted in Tavern
Runtime storage as execution evidence. Hermes remains canonical for native
execution behavior.

Cortex pages are Runtime-owned durable knowledge and memory. Hermes
context management for turns remains separate from Cortex memory. Tavern
reports these as separate readiness surfaces so users can tell whether
prompt-time context management is ready and whether Cortex capture, recall,
embeddings, and repair are ready.

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

Cortex repair does not sync from Hermes. Runtime-owned repair owns capture,
embedding repair, timeline and link repair, and Cortex audit output.

## Boundaries

* App backend ownership: [app.md](app.md)
* Chat API contract: [../api/chat.md](../api/chat.md)
* Testing and verification: [../operations/testing.md](../operations/testing.md)
