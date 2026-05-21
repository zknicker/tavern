# Tavern

Tavern is a macOS chat app for working with always-on agents.

Tavern Runtime is the local chat server. It owns canonical chats, messages,
participants, sequence, events, reads, deliveries, activity, automations, and
runtime-owned product state. Tavern App is the first-party Tauri client and
presentation layer. OpenClaw is the managed agent runtime: sessions, turns,
tools, model calls, files, and native transcripts stay execution-owned.

## Architecture

```text
Tavern App
  -> @tavern/sdk
  -> Tavern API
  -> Tavern Runtime
  -> managed OpenClaw
```

`packages/tavern-api` is the cross-boundary contract package. OpenAPI is the
wire source of truth, and the package also owns the shared Zod contracts used by
the current Runtime/App/admin surfaces.

`packages/tavern-sdk` is the TypeScript client over that API. Bots, webhooks,
automations, local tools, managed OpenClaw, tests, and the app use the SDK/API
shape instead of a second protocol package.

## Repo Layout

* `packages/tavern-api`: OpenAPI and shared Tavern API contracts.
* `packages/tavern-sdk`: TypeScript client wrapper for Tavern API.
* `packages/openclaw-gateway-adapter`: OpenClaw Gateway adapter and mappers.
* `packages/tavern-openclaw-messenger`: first-party OpenClaw channel plugin for
  Tavern chats.
* `apps/runtime`: always-on Tavern Runtime and managed OpenClaw supervisor.
* `apps/server`: local app backend, tRPC facade, app cache, and product logic.
* `apps/website`: Tauri/React app client.
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

`bun run dev` starts Tavern Runtime, managed OpenClaw Gateway, the local app
backend, the website dev server, and the desktop shell. Runtime builds and syncs
the Tavern Messenger plugin before launching managed OpenClaw.

Tavern state lives under `~/.tavern`. Managed OpenClaw state lives under
`~/.tavern/runtime/openclaw`.

## Desktop Build

Build a debug desktop app and DMG:

```bash
bun run desktop:build
```

The macOS outputs are written under
`apps/website/src-tauri/target/debug/bundle/`.

## Docs

Start with [docs/README.md](docs/README.md).
