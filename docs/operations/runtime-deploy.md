---
summary: Production Tavern Runtime deployment for a Mac mini using the runtime CLI, Homebrew service management, runtime URL configuration, and trusted-network assumptions.
read_when:
  - deploying Tavern Runtime to a Mac mini or always-on host
  - changing runtime CLI commands, Homebrew service packaging, runtime host/port defaults, or app runtime URL setup
  - separating Tavern desktop app releases from Tavern Runtime releases
---

# Runtime Deployment

Tavern Runtime is an always-on server process. The desktop app connects to its
configured Runtime URL.

## Runtime CLI

Keep the CLI small:

```bash
tavern-runtime serve
tavern-runtime --version
tavern-runtime --help
```

`serve` runs the foreground Runtime process. It starts the Runtime HTTP and
WebSocket API, Runtime storage, managed OpenClaw, first-party OpenClaw plugin
sync, Cortex, and Runtime jobs. It logs to stdout and stderr, and exits on
`SIGINT` or `SIGTERM`.

`tavern-runtime` does not own daemon lifecycle commands. Use the host service
manager for start, stop, restart, logs, and boot persistence.

## Homebrew Service

On the Mac mini, install and run Runtime through Homebrew:

```bash
brew install zknicker/tavern/tavern-runtime
brew services start tavern-runtime
```

The formula should run:

```bash
tavern-runtime serve
```

Use Homebrew for lifecycle:

```bash
brew services stop tavern-runtime
brew services restart tavern-runtime
brew upgrade tavern-runtime
```

## Configuration

Runtime defaults to local-only binding:

```bash
TAVERN_RUNTIME_HOST=127.0.0.1
TAVERN_RUNTIME_PORT=4310
TAVERN_RUNTIME_ROOT=~/.tavern/runtime
```

For a server that accepts app connections from another machine, set the host in
the service environment:

```bash
TAVERN_RUNTIME_HOST=0.0.0.0
TAVERN_RUNTIME_PORT=4310
```

The app stores a Runtime URL such as:

```txt
http://mac-mini.local:4310
```

Tavern does not enforce a network topology. Operators can use LAN DNS,
Tailscale, a reverse proxy, or another trusted network path.

## Trust Model

Runtime auth is not enabled yet. Expose the Runtime URL only on a trusted
network or behind operator-managed access control.

## Release Artifact

Runtime releases produce a standalone tarball:

```txt
tavern-runtime-<version>-aarch64-apple-darwin.tar.gz
```

The release publisher uploads that tarball and its checksum beside the desktop
updater artifacts under `TAVERN_RELEASE_S3_URI`. The formula URL uses the same
public `TAVERN_RELEASE_BASE_URL`.

`release:publish` updates `zknicker/homebrew-tavern` by default. Set
`TAVERN_HOMEBREW_TAP_REPO` to publish to another tap, or
`TAVERN_HOMEBREW_TAP_DIR` to update an existing local checkout.

The tarball contains:

```txt
bin/tavern-runtime
share/tavern/openclaw-plugins/
share/tavern/node_modules/@tavern/sdk/
```

The bundled plugin sources are synced into `~/.tavern/openclaw-plugins/` at
Runtime startup, then linked to the managed OpenClaw install.
