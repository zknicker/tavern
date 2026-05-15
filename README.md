# Tavern

Tavern is an OpenClaw dashboard, agent homebase, and utility layer backed by Tavern Runtime, which
supplies OpenClaw with memory, task management, and other first-class agent primitives.

## Architecture

At a high level, Tavern is the product and projection layer. OpenClaw executes work. The OpenClaw
Gateway adapter keeps those worlds connected without leaking raw Gateway payloads into the app.

```text
People
  |
  v
Tavern App
  |  chat UI, settings, local optimistic state
  v
Tavern Server
  |  product APIs: chats, sessions, agents, cron, memory, jobs
  |
  +-- Tavern-owned state
  |     memory, profiles, participant links, sync state, local projections
  |
  +-- OpenClaw Gateway adapter
        maps OpenClaw Gateway API/events <-> Tavern primitives
        |
        v
      Remote OpenClaw Gateway
        |
        +-- Tavern Messenger plugin
        |     first-party Tavern chat channel inside OpenClaw
        |     v1: one Tavern chat -> one OpenClaw agent session
        |
        +-- OpenClaw execution
              agents, sessions, turns, tools, messages, cron, files, platform channels

Fast lane:
  user send -> runtime accepts run -> live reply/tool events -> active UI state

Durable lane:
  runtime history -> adapter -> protocol records -> SQLite projections -> app reads
```

The browser app and product domains speak Tavern product APIs. Server OpenClaw code speaks the
shared Tavern primitive contracts. OpenClaw Gateway payloads and Tavern Messenger channel payloads
stay behind the OpenClaw adapter.

### Tavern Runtime

Tavern Runtime owns durable Tavern-specific state: memory, knowledge/task systems, profile
settings, participant links, agent visual customizations, sync state, and local projections. It does
not own the OpenClaw install, OpenClaw home, or OpenClaw-native execution config.

### OpenClaw

OpenClaw owns native agents, cron jobs, sessions, messages, files, skills, model/runtime config,
platform channels, and execution behavior. Tavern talks to one remote OpenClaw Gateway. Tavern
Messenger plugin remains installed in OpenClaw so Tavern chat sends preserve Tavern-native chat,
session, turn, and optimistic message identity.

### Tavern Primitives

The shared primitives are:

- `agent`
  OpenClaw-owned agent projected into Tavern, plus Tavern-owned presentation/customization.
- `chat`
  Durable conversation container, normalized across platforms.
- `session`
  Runtime conversation or execution inside a chat.
- `message`
  Observed session history.
- `turn`
  One execution unit, including cron/manual agent work.
- `cron job`
  OpenClaw-owned scheduled config, projected locally.
- `participant`
  Non-agent actor observed from a platform, optionally manually linked to the Tavern profile.
- `agent files`
  OpenClaw-owned files exposed through the OpenClaw Gateway.

### Platforms

Discord, Telegram, Slack, iMessage, and similar systems are platform/transport concepts under
OpenClaw. They should be normalized by the OpenClaw adapter before reaching Tavern.
Discord-specific parsing belongs in the OpenClaw adapter's Discord platform module, not in generic
Tavern app code.

### Sync Strategy

Tavern is sync-first. It periodically and event-triggeredly pulls OpenClaw-owned data into local
projections with `last_synced_at`. The app reads projections by default, so views remain fast and
usable when OpenClaw is offline. OpenClaw-owned edits go directly to the Gateway, then Tavern
triggers a fresh sync.

Config/history distinction:

- Config like agents, cron jobs, skills, and files is OpenClaw-owned and projected for browsing or
  editing, but writes go to OpenClaw.
- History like sessions, messages, and cron runs is projected from observed OpenClaw history. Tavern
  upserts stable ids, updates changed rows, and only deletes within authoritative result windows.

### OpenClaw Adapter

The OpenClaw Gateway adapter is the boundary. It maps real OpenClaw Gateway payloads into strict
Tavern protocol shapes without inventing required identity, schedule, or time fields.
Platform-specific logic, especially Discord chat identity and participants, belongs in dedicated
adapter modules before the data reaches Tavern.

## System Overview

Tavern sits between people, OpenClaw, and supporting data systems. It owns the Tavern product model
and maps OpenClaw capabilities into Tavern primitives.

```text
                              +---------------------------+
                              | Humans / Dashboard / MCP  |
                              | CLI / API                 |
                              +-------------+-------------+
                                            |
                                            v
    +------------------------------------------------------------------------+
    |                               Tavern                               |
    |            App, Tavern Runtime, projections, API, and UI               |
    +------------------------------------------------------------------------+
         |                 |                 |                 |
         v                 v                 v                 v
   +-------------+   +-------------+   +-------------+   +-------------+
   |   Agents    |   |    Chats    |   |  Sessions   |   |    Cron     |
   +-------------+   +-------------+   +-------------+   +-------------+
         |                 |                 |                 |
         v                 v                 v                 v
   +-------------+   +-------------+   +-------------+   +-------------+
   |   Events    |   |  Memories   |   |   Models    |   |    Jobs     |
   +-------------+   +-------------+   +-------------+   +-------------+

      OpenClaw and supporting data systems plug into Tavern from below:

   +-----------------------+   +-----------+   +----------------------+
   | Remote OpenClaw       |   |  Memory   |   | Tavern Runtime      |
   | Gateway + Messenger   |   | services  |   | agent utilities     |
   +-----------------------+   +-----------+   +----------------------+
```

Technical notes live under `docs/`.

## Sync Model

Tavern renders from local SQLite first. Runtime transports are execution targets and freshness
signals, not rendering preconditions.

## Repo Layout

- `packages/agent-runtime-protocol`
  Shared first-party primitive contracts used by Tavern Runtime and the OpenClaw adapter.
- `packages/openclaw-gateway-adapter`
  OpenClaw Gateway WebSocket adapter that returns Tavern agent-runtime protocol shapes.
- `packages/tavern-openclaw-messenger`
  Installable OpenClaw channel plugin for first-party Tavern chat.
- `apps/server`
  Fastify + tRPC + SQLite-backed sync, materialization, and product-owned server logic.
- `apps/website`
  React Router + React Query + tRPC client UI.
- `apps/runtime`
  Tavern Runtime service for Tavern-owned memory, tasks, and agent-facing utilities.
- `jobs`
  Tavern-owned background jobs for sync, usage ingest, and refresh work.

## Development

1. Install dependencies with `bun install`.
2. Install and start OpenClaw locally so its Gateway is listening on `127.0.0.1:18789`.
3. Run the Tavern dev stack with the Tavern Runtime URL:

```bash
TAVERN_RUNTIME_URL=http://127.0.0.1:4310 \
bun run dev:runtime
```

Tavern stores local state in SQLite at `DATABASE_PATH`, defaulting to `~/.tavern/tavern.sqlite`.
`bun run dev:runtime` starts the web app, server, and local development Tavern Runtime. It does not
start or manage OpenClaw; Tavern Runtime connects to the local OpenClaw Gateway at
`ws://127.0.0.1:18789` with the token from `OPENCLAW_GATEWAY_TOKEN` or `~/.openclaw/openclaw.json`.
Before starting Tavern Runtime, the dev stack deploys the Tavern Messenger plugin from this
worktree to `~/.tavern/openclaw-plugins/tavern-openclaw-messenger` and points OpenClaw at that
stable path. This keeps `~/.openclaw/openclaw.json` from referencing deleted Conductor worktrees.

The local `~/.openclaw` install is the development OpenClaw sandbox for this repo. It is acceptable
for local smoke tests to install skills, materialize agent workspace skills, and clean up generated
state there. Do not use a production or shared OpenClaw home for this development loop.

For desktop development, use the same Tavern Runtime URL with `bun run desktop:dev:runtime`.

Runtime startup does not require Docker. Agent execution belongs to OpenClaw.
Tavern configures OpenClaw sandboxes with a one-hour idle prune window and the dev stack removes
Tavern-owned sandbox containers on shutdown. To clean up leftovers from crashed dev sessions or e2e
runs, use `bun run dev:docker:cleanup`.

## Desktop Build

Build a debug desktop app and DMG with:

```bash
bun run desktop:build
```

This compiles the website, produces a bundled Tavern sidecar binary, and builds the Tauri shell.
For `bun run desktop:dev`, Tavern points Cargo at a shared user cache directory so fresh
workspaces can reuse Rust build artifacts instead of recompiling them into each workspace-local
`src-tauri/target` directory. If `sccache` is installed and on `PATH`, desktop commands also use
it as the Rust compiler wrapper. On macOS, install it with `brew install sccache`. If it is not
installed, desktop commands still work and fall back to plain Cargo builds.

The dev launcher accepts a single optional base port as its first positional argument or via
`--port`; Tavern uses that for Vite and defaults the backend to the next port. Use `--vite-port`
and `--backend-port` when you need to override them separately. The launcher also accepts an
optional `--pid`, which it exports to the Tauri dev process as `TAVERN_DESKTOP_DEV_PID`.

The macOS outputs are written under `apps/website/src-tauri/target/debug/bundle/`.

## Docker Deploy

The older Docker deployment flow needs a follow-up pass after the SQLite switch. Use
`.env.docker.example` as the starting point and make sure the server has a writable volume for
`DATABASE_PATH`.

## Safety

The dashboard is still unauthenticated. Keep it localhost or Tailscale only unless you add auth.
