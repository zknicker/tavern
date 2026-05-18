---
read_when:
  - changing the always-on chat server, managed OpenClaw startup, or runtime ownership
  - changing sync paths, execution evidence, or agent-facing Tavern tools
---

# Tavern Runtime

Tavern Runtime is the local always-on server. It owns canonical chat history and
local integration. It is not the product UI and it is not a replacement agent
executor.

## Ownership

* **Tavern Runtime owns chat and local integration.** It stores canonical chats,
  messages, participants, events, reads, automations, and delivery state. It
  starts managed OpenClaw, applies Tavern-owned config, carries runtime events,
  stores runtime settings, and exposes Tavern tools to agents.
* **OpenClaw owns execution.** Agents, sessions, turns, transcripts, files,
  tools, model calls, and native OpenClaw config behavior remain OpenClaw-owned.
* **Tavern App owns presentation.** The app reads runtime chat history, caches
  what it needs, and renders chats, activity, settings, memory, automations,
  skills, and stats.
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

## Tavern Messenger Plugin

Runtime builds and syncs `packages/tavern-openclaw-messenger` into the managed
plugin directory before launching OpenClaw.

Plugin lifecycle details live in
[../operations/openclaw-plugin-deploy.md](../operations/openclaw-plugin-deploy.md).
Plugin architecture lives in
[tavern-openclaw-messenger-plugin.md](tavern-openclaw-messenger-plugin.md).

## Persistence

`~/.tavern` is the backup unit. It contains Tavern's runtime chat database,
memory, vault, managed skills, runtime settings, app cache, and projected
OpenClaw archives.

Tavern Runtime chat records are canonical. OpenClaw-owned execution records
that Tavern renders relationally are stored as projections with freshness
metadata. OpenClaw remains canonical for native execution evidence.

## Sync Paths

Each OpenClaw-owned execution primitive has one sync path:

| Primitive | Projection |
| --- | --- |
| agent | current OpenClaw agents |
| session | OpenClaw session index |
| transcript message | OpenClaw session history evidence |
| automation execution | OpenClaw turn/session evidence for a Tavern automation |

Jobs, websocket events, manual refreshes, and post-edit refreshes reuse the same
primitive sync path instead of duplicating Gateway fetch logic.

## Boundaries

* App backend ownership: [app.md](app.md)
* Chat API contract: [../api/chat.md](../api/chat.md)
* Runtime upgrade recipe:
  [../operations/openclaw-runtime-upgrade.md](../operations/openclaw-runtime-upgrade.md)
