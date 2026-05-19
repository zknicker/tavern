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

Verify the generated managed config:

```bash
jq '.plugins.load.paths' ~/.tavern/runtime/openclaw/run/openclaw.json
```

## Managed Installs

Tavern extends the generated OpenClaw config with `plugins.installs` records for
managed third-party plugin installation. This is Tavern-owned metadata, not an
OpenClaw runtime loading primitive.

The install flow is:

1. Runtime reads Tavern-authored `plugins.installs` records.
2. Runtime installs each npm package into the managed OpenClaw install root.
3. Runtime adds each installed package path to the OpenClaw-native
   `plugins.load.paths` array.
4. OpenClaw loads plugins from `plugins.load.paths`, then applies the native
   `plugins.allow`, `plugins.entries`, and `plugins.slots` settings.

`plugins.installs` records use this shape:

```json
{
  "plugins": {
    "installs": {
      "plugin-id": {
        "source": "npm",
        "spec": "@scope/openclaw-plugin@1.2.3"
      }
    }
  }
}
```

Runtime removes `plugins.installs` from the final authored config after turning
install records into load paths. The generated config should keep OpenClaw's
runtime-facing fields explicit:

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

Built-in managed dependencies can also be installed without an authored
`plugins.installs` record. Lossless Claw is installed this way: Runtime always
resolves the default install spec, adds its package root to `plugins.load.paths`,
enables `lossless-claw`, sets `plugins.slots.contextEngine` to `lossless-claw`,
and sets `plugins.slots.memory` to `none`.

Verify the lifecycle directly:

```bash
bun run --filter @tavern/runtime build
```

Changed plugin module bytes are loaded by restarting the Tavern Runtime dev
stack.

## Architecture

Plugin architecture and audit notes live in
[../internals/tavern-openclaw-messenger-plugin.md](../internals/tavern-openclaw-messenger-plugin.md).
