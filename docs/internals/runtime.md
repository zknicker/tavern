---
summary: Tavern Runtime internals for canonical chat storage, managed Hermes startup, adapter projection, persistence, ingestion paths, and tool boundaries.
read_when:
  - changing the always-on chat server, managed Hermes startup, or runtime ownership
  - changing ingestion paths, execution evidence, managed workspace instructions, or agent-facing Tavern tools
---

# Tavern Runtime

Tavern Runtime is the local always-on server. It owns canonical chat history and
local service connections. It is not the product UI and it is not a replacement agent
executor.

## Ownership

* **Tavern Runtime owns chat and local service connections.** It stores canonical chats,
  messages, participants, events, reads, automations, agents, and delivery
  state. It starts managed Hermes, carries runtime events, stores runtime
  settings, exposes Memory reads, and exposes Tavern tools to agents.
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
  what it needs, and renders chats, activity, settings, Memory, automations,
  skills, and stats.
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

The dev stack derives a stable port group from the worktree path by default, or
from `TAVERN_DEV_STACK_ID` when a run intentionally shares state across
worktrees, and passes the same `TAVERN_RUNTIME_PORT`, `TAVERN_RUNTIME_URL`, and
`TAVERN_HERMES_PORT` to Runtime, server, website, and desktop. Use
`TAVERN_DEV_STACK_ID`, `TAVERN_DEV_PORT_BASE`, `TAVERN_RUNTIME_ROOT`,
`TAVERN_HERMES_HOME`, `TAVERN_HERMES_BIN`, `TAVERN_HERMES_HOST`,
`TAVERN_HERMES_PORT`, and `TAVERN_HERMES_TOKEN` to isolate or point a local run
at a specific Hermes process. Runtime marks Hermes ready only after the
dashboard HTTP status route responds and `/api/ws` accepts a WebSocket
connection.

## Managed Workspace

`AGENTS.md` is a generated artifact with Runtime as its single writer
(`apps/runtime/src/workspace/instructions.ts`): composed deterministically from
the Tavern-managed content (`managed-instructions.ts`), the agent name, and
`NOTES.md`, written read-only, and rewritten only when the composed bytes
change — so prompt-cache invalidation happens exactly when a source changes
and never per turn. The generated file tells the agent it is immutable and
that `NOTES.md` is its durable instructions source. The managed content includes
Tavern environment, Memory, Workspace/workbench, Rich Response, delegation,
skill-maintenance, and progress guidance. For skill work, it tells agents to inspect the current
skill catalog with native skill tools before creating or patching skill
content. For external skill search, it uses
`hermes skills search <query> --source skills-sh` unless the user names a
different source.

The editable agent files are the sources. `NOTES.md` (workspace) carries
durable notes, instructions, and conventions: the user edits it in settings,
the agent edits it directly with file tools, and Runtime seeds it as an empty
file for new workspaces. When migrating a pre-generated `AGENTS.md`, Runtime
seeds `NOTES.md` once with the old user/agent content and never writes it
again.
`SOUL.md` (managed Hermes home) carries identity and personality; Runtime
never writes it. Regeneration runs on agent sync, on `NOTES.md` saves through
the agent file API, and via a filesystem watch on `NOTES.md`
(`workspace/notes-watcher.ts`) for direct agent edits. See
[workspace.md](../../specs/workspace.md) for the contract.

Runtime also creates `workbench/` under the managed workspace. That directory is
the user-visible Workspace surface for durable files, projects, code, assets,
and experiments that are not Memory. The app should expose `workbench/`, not the
managed workspace root.

Fresh Hermes homes seed `SOUL.md`; they do not seed a default workspace
`AGENTS.md`. Tavern generates its own workspace context so managed chats always
load Tavern-specific instructions from the session cwd.

When generation writes the file, Runtime also clears unsupported legacy
companion bootstrap files from the managed workspace. It does not clear
`SOUL.md` or the engine's native memory files under the managed home
`memories/` directory.

Runtime also has to pass the managed workspace as the Hermes execution context.
Chat sessions use `session.create.cwd`; Tavern-created cron jobs use `workdir`.
Without that context, Hermes runs but does not inject the generated `AGENTS.md`,
including Tavern skills and visible-progress guidance.

Generated instructions also include a compact inspectable-output rule. When an
agent creates or updates workspace files, Memory files, Markdown or HTML docs,
images, or generated assets, its final reply links them with a Markdown link.
Tools may return the canonical link; otherwise agents use Tavern internal
links such as `tavern://workspace/path` or `tavern://vault/path`. The app
renderer contract is to resolve those links to Artifact Panel targets under
the current runtime scope; they are not local absolute paths or external URLs.
Runtime exposes workspace targets through read-only
`/workspace/agents/{id}/files` routes that resolve inside the registered agent
workspace, block traversal and sensitive files, and return preview content.
Memory targets resolve through the Vault API compatibility surface.

The agent's operational access to Tavern ships as the managed `tavern` skill
(`apps/runtime/src/hermes/tavern-skill.ts`): chat reads and searches, attributed
deliveries into chats, read-only self-configuration lookups, and the settings
map, all over the local Runtime API. The generated instructions point the agent
at the skill; [tavern-skill.md](../../specs/tavern-skill.md) is the contract.

## Persistence

The Runtime root is the backup unit. It defaults to
`~/.tavern/runtime` and contains Tavern's runtime chat database, managed
skills, runtime settings, generated Hermes home/workspace, Memory metadata, and
projected Hermes execution evidence. The dev stack uses
`~/.tavern/dev/<worktree-id>/runtime` by default.

Tavern Runtime chat records are canonical. Hermes-owned execution records
that Tavern renders, inspects, searches, or recovers are persisted in Tavern
Runtime storage as execution evidence. Hermes remains canonical for native
execution behavior.

Memory is a Runtime read/write surface over durable Markdown knowledge. Hermes
context management for turns remains separate from durable Memory. Tavern
reports Memory readiness separately from prompt-time context management.

Memory and compatibility wire contracts live in [Memories](../../specs/memories.md)
and [Compatibility Vault](../../specs/vault.md).

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

Memory maintenance does not sync from Hermes. Agents perform Memory work through
the managed `memory` skill.

## Boundaries

* App backend ownership: [app.md](app.md)
* Chat API contract: [../api/chat.md](../api/chat.md)
* Testing and verification: [../operations/testing.md](../operations/testing.md)
