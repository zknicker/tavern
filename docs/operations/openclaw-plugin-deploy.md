---
summary: Managed Messenger plugin workflow for Runtime-owned build/sync into OpenClaw, generated config checks, and lifecycle verification.
read_when:
  - changing how managed OpenClaw loads the Tavern Messenger plugin
  - verifying plugin build, sync, or managed Gateway lifecycle
---

# Tavern Messenger Plugin Lifecycle

Tavern Runtime owns the local Tavern Messenger plugin lifecycle. Do not deploy
to or restart a global `~/.openclaw` Gateway for normal Tavern Runtime work.

## Development

Run the managed dev stack:

```bash
bun run dev
```

During startup, Runtime builds `packages/tavern-openclaw-messenger`, syncs it
into the managed plugin directory, and launches OpenClaw with the generated
config.

Verify the generated managed config:

```bash
jq '.plugins.load.paths' ~/.tavern/runtime/openclaw/run/openclaw.json
```

Verify the lifecycle directly:

```bash
bun run --filter @tavern/runtime build
```

Changed plugin module bytes are loaded by restarting the Tavern Runtime dev
stack.

## Architecture

Plugin architecture and audit notes live in
[../internals/tavern-openclaw-messenger-plugin.md](../internals/tavern-openclaw-messenger-plugin.md).
