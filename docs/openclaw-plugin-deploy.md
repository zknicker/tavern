# Tavern Messenger Plugin Lifecycle

Tavern Runtime owns the local Tavern Messenger plugin lifecycle for managed OpenClaw.

## Local Development

The local Tavern Runtime runs its own managed OpenClaw Gateway and reads the Tavern Messenger
plugin from Tavern's local plugin directory. Do not restart the global `~/.openclaw` Gateway for
normal Tavern Runtime development; it uses the same default port and will block managed runtime
startup.

Current local paths:

- Gateway bind: `127.0.0.1:18789`
- Managed config: `~/.tavern/runtime/openclaw/run/openclaw.json`
- Tavern Messenger plugin path:
  `/Users/zknicker/.tavern/openclaw-plugins/tavern-openclaw-messenger`

Run the Tavern Runtime dev stack:

```bash
bun run dev
```

During startup, the dev stack builds `packages/tavern-openclaw-messenger`, then Tavern Runtime
syncs that package into the stable managed plugin path before launching OpenClaw. Runtime health
records the managed plugin as the `tavernPlugin` capability.

Verify the generated managed OpenClaw config:

```bash
jq '.plugins.load.paths' ~/.tavern/runtime/openclaw/run/openclaw.json
```

Build the Runtime and managed plugin lifecycle directly:

```bash
bun run --filter @tavern/runtime build
```

Changed plugin module bytes are loaded by restarting the Tavern Runtime dev stack.

## Manual Recovery

Manual copy should only be needed if the Runtime startup sync is broken:

```bash
rsync -az --delete \
  packages/tavern-openclaw-messenger/ \
  /Users/zknicker/.tavern/openclaw-plugins/tavern-openclaw-messenger/
```

Verify copied plugin bytes:

```bash
grep -R "handleTavernInboundMessage" -n \
  /Users/zknicker/.tavern/openclaw-plugins/tavern-openclaw-messenger/src/turn.js
```

Restart the Tavern Runtime dev stack after manual recovery.
