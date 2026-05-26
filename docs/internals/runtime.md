---
summary: Tavern Runtime internals for canonical chat storage, managed OpenClaw startup, Messenger plugin sync, persistence, sync paths, and tool boundaries.
read_when:
  - changing the always-on chat server, managed OpenClaw startup, or runtime ownership
  - changing sync paths, execution evidence, managed workspace instructions, or agent-facing Tavern tools
---

# Tavern Runtime

Tavern Runtime is the local always-on server. It owns canonical chat history and
local integration. It is not the product UI and it is not a replacement agent
executor.

## Ownership

* **Tavern Runtime owns chat and local integration.** It stores canonical chats,
  messages, participants, events, reads, automations, and delivery state. It
  starts managed OpenClaw, applies Tavern-owned config, carries runtime events,
  stores runtime settings, owns Cortex storage, and exposes Tavern tools to
  agents.
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
  cursor-backed. Gateway events trigger focused sync paths; they are not durable
  chat history by themselves.

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
file combines Tavern-managed instructions, the user's agent soul/personality,
and agent-authored notes stored by Tavern. Other OpenClaw bootstrap markdown
files stay blank or unused for managed Tavern agents.

Agents update their notes through Tavern workspace tools instead of editing
`AGENTS.md` directly. Runtime regenerates the file on boot, config sync, and
instruction source changes.

## Persistence

`~/.tavern` is the backup unit. It contains Tavern's runtime chat database,
Cortex, vault, managed skills, runtime settings, app cache, and projected
OpenClaw archives.

Tavern Runtime chat records are canonical. OpenClaw-owned execution records
that Tavern renders relationally are stored as projections with freshness
metadata. OpenClaw remains canonical for native execution evidence.

Cortex pages are Runtime-owned durable knowledge and memory. Lossless Claw
remains OpenClaw-owned context management for turns. Tavern reports these as
separate readiness surfaces so users can tell whether prompt-time context
management is ready and whether Cortex capture, recall, embeddings, and
maintenance are ready.

Memory and Cortex product contracts live in [Memories](../../specs/memories.md)
and [Cortex](../../specs/cortex.md).

## Sync Paths

Each OpenClaw-owned execution primitive has one sync path:

| Primitive | Projection |
| --- | --- |
| agent | current OpenClaw agents |
| session | OpenClaw session index |
| transcript message | OpenClaw session history evidence |
| automation execution | OpenClaw turn/session evidence for a Tavern automation |

Active chat turns use a focused sync path. When OpenClaw reports that a known
turn completed or failed, Runtime syncs that turn's session history by
`sessionKey` and invalidates the affected chat log. It does not refresh the full
OpenClaw session index before updating the active conversation.

Broad session and chat index syncs are for dashboard, sidebar, settings, manual
refresh, and background catch-up surfaces. They must not block the active chat
handoff for a known turn.

Cortex maintenance does not sync from OpenClaw. Runtime jobs own capture,
embedding repair, timeline and link maintenance, and Cortex audit output.

Jobs, websocket events, manual refreshes, and post-edit refreshes reuse the same
primitive sync path instead of duplicating Gateway fetch logic.

## Boundaries

* App backend ownership: [app.md](app.md)
* Chat API contract: [../api/chat.md](../api/chat.md)
* Runtime upgrade recipe:
  [../operations/openclaw-runtime-upgrade.md](../operations/openclaw-runtime-upgrade.md)
