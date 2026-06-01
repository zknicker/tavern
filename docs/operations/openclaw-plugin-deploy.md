---
summary: Managed Tavern OpenClaw plugin workflow for Runtime-owned build/sync, generated config checks, and lifecycle verification.
read_when:
  - changing how managed OpenClaw loads Tavern first-party plugins
  - verifying plugin build, sync, or managed Gateway lifecycle
---

# Tavern OpenClaw Plugin Lifecycle

Tavern Runtime owns the local first-party OpenClaw plugin lifecycle. Do not
deploy to or restart a global `~/.openclaw` Gateway for normal Tavern Runtime
work.

## Development

Run the managed dev stack:

```bash
bun run dev
```

During startup, Runtime builds and syncs:

* `packages/tavern-openclaw-messenger` for Tavern chat/channel delivery.
* `packages/tavern-openclaw-cortex` for Cortex agent tools.
* `packages/tavern-openclaw-workspace` for generated workspace instructions,
  agent notes tools, and generated-file guards.

OpenClaw launches with all managed plugin paths in the generated config.

While the dev stack is running, changes under those first-party plugin packages
trigger a managed plugin rebuild and Runtime restart. Runtime startup then
syncs the changed plugin sources into `~/.tavern/openclaw-plugins/` before
OpenClaw loads them. Watch the dev stack log for `managed OpenClaw plugins
synced` after editing plugin code.

Verify the generated managed config:

```bash
jq '.plugins.load.paths' ~/.tavern/runtime/openclaw/run/openclaw.json
```

## Managed Installs

Tavern keeps managed npm install specs in Runtime code, not in OpenClaw config.
Generated config contains only OpenClaw-native plugin fields.

The install flow is:

1. Runtime resolves its in-code install specs and enabled channel plugins.
2. Runtime installs each npm package into the managed OpenClaw install root.
3. Runtime adds each installed package path to `plugins.load.paths`.
4. OpenClaw loads plugins from `plugins.load.paths`, then applies
   `plugins.allow`, `plugins.entries`, and `plugins.slots`.

The generated config keeps OpenClaw's runtime-facing fields explicit:

```json
{
  "plugins": {
    "load": {
      "paths": [".../node_modules/@scope/openclaw-plugin"]
    },
    "allow": ["plugin-id"],
    "entries": {
      "plugin-id": {
        "enabled": true
      }
    }
  }
}
```

Managed OpenClaw does not install or enable Lossless Claw. Runtime keeps the
OpenClaw `memory` slot set to `none` and strips stale managed memory plugins,
including `lossless-claw`, from regenerated configs.

Verify the lifecycle directly:

```bash
bun run --filter @tavern/runtime build
```

That command verifies the plugin packages and Runtime build. The dev stack owns
the live plugin sync and reload path.

## Architecture

Plugin architecture and audit notes live in
[../internals/tavern-openclaw-messenger-plugin.md](../internals/tavern-openclaw-messenger-plugin.md).
