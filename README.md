# Tavern

Tavern is a macOS chat app for working with always-on agents.

Tavern Runtime is the local chat server. It owns canonical chats, messages,
participants, sequence, events, reads, deliveries, activity, automations, and
runtime-owned product state. Tavern App is the first-party Electron client and
presentation layer. Hermes is the managed agent runtime: sessions, turns,
tools, model calls, files, and native transcripts stay execution-owned.

## Architecture

```text
Tavern App
  -> @tavern/sdk
  -> Tavern API
  -> Tavern Runtime
  -> managed Hermes
```

`packages/tavern-api` is the cross-boundary contract package. OpenAPI is the
wire source of truth, and the package also owns the shared Zod contracts used by
the current Runtime/App/admin surfaces.

`packages/tavern-sdk` is the TypeScript client over that API. Bots, webhooks,
automations, local tools, managed Hermes, tests, and the app use the SDK/API
shape instead of a second protocol package.

## Repo Layout

* `packages/tavern-api`: OpenAPI and shared Tavern API contracts.
* `packages/tavern-sdk`: TypeScript client wrapper for Tavern API.
* `apps/runtime`: always-on Tavern Runtime and managed Hermes supervisor.
* `apps/server`: local app backend, tRPC facade, app cache, and product logic.
* `apps/website`: Electron/React app client.
* `jobs`: local background jobs for sync, usage ingest, and refresh work.

## Development

Install dependencies:

```bash
bun install --frozen-lockfile
```

Run the full local stack:

```bash
bun run dev
```

`bun run dev` starts Tavern Runtime, managed Hermes dashboard/API/Gateway, the
local app backend, the website dev server, and the desktop shell.

Dev state is isolated under `~/.tavern-hermes/dev/<worktree-id>`. The default
Runtime root outside the dev stack is `~/.tavern-hermes/runtime`.

Local dev ports are derived from the worktree path so multiple worktrees can run
at once. Override them with:

```bash
TAVERN_RUNTIME_HOST=127.0.0.1
TAVERN_RUNTIME_PORT=18790
TAVERN_HERMES_PORT=29119
```

Set `TAVERN_RUNTIME_HOST=0.0.0.0` and point the app at
`http://<host>:18790` when Runtime runs on an always-on Mac.

Production Runtime installs expose `tavern` as the preferred CLI and keep
`tavern-runtime` as a compatibility alias. `tavern update` upgrades the
Homebrew formula and restarts the service by default.

## Desktop Build

Build a debug desktop app and DMG:

```bash
bun run desktop:build
```

The macOS outputs are written under `apps/website/electron-dist/`.

## Docs

Start with [docs/README.md](docs/README.md).
