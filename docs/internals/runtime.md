---
summary: Tavern Runtime internals for canonical chat storage, managed OpenClaw startup, Messenger plugin sync, persistence, ingestion paths, and tool boundaries.
read_when:
  - changing the always-on chat server, managed OpenClaw startup, or runtime ownership
  - changing ingestion paths, execution evidence, managed workspace instructions, or agent-facing Tavern tools
---

# Tavern Runtime

Tavern Runtime is the local always-on server. It owns canonical chat history and
local integration. It is not the product UI and it is not a replacement agent
executor.

## Ownership

* **Tavern Runtime owns chat and local integration.** It stores canonical chats,
  messages, participants, events, reads, automations, agents, and delivery
  state. It starts managed OpenClaw, applies Tavern-owned config, carries
  runtime events, stores runtime settings, owns Cortex storage, and exposes
  Tavern tools to agents.
* **Runtime owns managed OpenClaw config mutations.** User-facing settings enter
  Runtime as domain updates, such as agent name, selected model, thinking
  default, or Discord binding changes. Runtime translates those updates into the
  current OpenClaw config, applies the config through Gateway, refreshes stored
  snapshots, and emits focused runtime events.
* **OpenClaw owns execution.** Agents, sessions, turns, transcripts, files,
  tools, model calls, prompt-time context management, and native OpenClaw config
  behavior remain OpenClaw-owned.
* **The OpenClaw relay is transport only.** Runtime creates chats, binds chats
  to agents and session keys, writes durable Tavern messages, and then dispatches
  accepted work through the relay. The relay references existing Runtime chat
  and message ids; it does not create chats, repair chats, or write chat-level
  Tavern metadata.
* **Tavern App owns presentation.** The app reads runtime chat history, caches
  what it needs, and renders chats, activity, settings, memory inspection, the
  Cortex wiki, automations, skills, and stats.
* **Events are recoverable notifications.** Runtime chat events are durable and
  cursor-backed. Gateway events trigger focused ingestion paths; they are not
  durable chat history by themselves.

## Managed OpenClaw

Local development starts the full stack with:

```bash
bun run dev
```

That launches Tavern Runtime, managed OpenClaw Gateway, the app backend, and the
website dev server. Runtime uses the pinned repo `openclaw` version and stores
managed OpenClaw state under `~/.tavern/runtime/openclaw`.

Key paths:

```txt
~/.tavern/runtime/openclaw/versions/<version>/
~/.tavern/runtime/openclaw/run/openclaw.json
~/.tavern/runtime/openclaw/run/state/
~/.tavern/runtime/openclaw/run/workspace/
```

The managed Gateway runs through macOS Seatbelt. Seatbelt is a guardrail, not a
container. Strong isolation belongs in Docker, a VM, a separate macOS user, or a
separate machine.

## Tavern OpenClaw Plugins

Runtime builds and syncs first-party OpenClaw plugins into the managed plugin
directory before launching OpenClaw:

* `packages/tavern-openclaw-messenger` owns Tavern chat/channel delivery.
* `packages/tavern-openclaw-cortex` owns Cortex agent tools.
* `packages/tavern-openclaw-workspace` owns managed workspace instructions,
  generated-file protection, and agent notes tools.

Plugin lifecycle details live in
[../operations/openclaw-plugin-deploy.md](../operations/openclaw-plugin-deploy.md).
Plugin architecture lives in
[tavern-openclaw-messenger-plugin.md](tavern-openclaw-messenger-plugin.md).

## Managed Workspace

Runtime writes a generated `AGENTS.md` into the managed OpenClaw workspace. The
file combines Tavern-managed instructions, the user's agent instructions block,
and agent-authored notes stored by Tavern. Other OpenClaw bootstrap markdown
files stay blank or unused for managed Tavern agents.

Runtime clears legacy companion bootstrap files from the managed workspace
before rendering `AGENTS.md`. Empty files are intentional: OpenClaw skips blank
bootstrap files but may inject marker lines for missing ones. Tavern leaves
OpenClaw bootstrap injection enabled, and Tavern chat turns use full bootstrap
context so generated `AGENTS.md` reaches turns.

Agents update their notes through Tavern workspace tools instead of editing
`AGENTS.md` directly. Runtime regenerates the file on boot, config sync, and
instruction source changes.

## Persistence

`~/.tavern` is the backup unit. It contains Tavern's runtime chat database,
Cortex, vault, managed skills, runtime settings, app cache, and projected
OpenClaw archives.

Tavern Runtime chat records are canonical. OpenClaw-owned execution records
that Tavern renders, inspects, searches, or recovers are persisted in Tavern
Runtime storage as execution evidence. OpenClaw remains canonical for native
execution behavior.

Cortex pages are Runtime-owned durable knowledge and memory. OpenClaw
context management for turns remains separate from Cortex memory. Tavern
reports these as separate readiness surfaces so users can tell whether
prompt-time context management is ready and whether Cortex capture, recall,
embeddings, and repair are ready.

Memory and Cortex product contracts live in [Memories](../../specs/memories.md)
and [Cortex](../../specs/cortex.md).

## Runtime Ingestion

OpenClaw execution enters Tavern through Runtime ingestion paths. App-facing
queries read Tavern Runtime storage; they do not reach around Runtime to
OpenClaw. Gateway-ready sync avoids OpenClaw reference catalogs such as skills,
models, external chat projections, and session indexes. Skill and model surfaces
return the latest stored snapshot immediately and refresh in the background when
the snapshot is missing or stale. The skill inventory refresh runs on startup,
every 15 minutes, and after skill-related writes; it emits a skill update event
only when stored inventory changes. OpenClaw events refresh the named agent or
skill. Session events record the small session row when the event carries it and
otherwise act as freshness notifications; they do not pull full transcripts or
graphs during normal chat flow. Session index surfaces use bounded Runtime
previews. Session inspection uses a bounded recent history window.

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

Cortex repair does not sync from OpenClaw. Runtime-owned repair owns
capture, embedding repair, timeline and link repair, and Cortex audit
output.

## Boundaries

* App backend ownership: [app.md](app.md)
* Chat API contract: [../api/chat.md](../api/chat.md)
* Runtime upgrade recipe:
  [../operations/openclaw-runtime-upgrade.md](../operations/openclaw-runtime-upgrade.md)
