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
tavern serve
tavern update
tavern update --no-restart
tavern restart
tavern --version
tavern --help
```

`serve` runs the foreground Runtime process. It starts the Runtime HTTP and
WebSocket API, Runtime storage, managed OpenClaw, first-party OpenClaw plugin
sync, Cortex, and Runtime jobs. It logs to stdout and stderr, and exits on
`SIGINT` or `SIGTERM`.

`tavern` is the preferred CLI. `tavern-runtime` remains as a compatibility
alias.

`update` shells out to Homebrew and restarts the service by default. Use
`tavern update --no-restart` to upgrade without restarting. Use Homebrew
directly for stop, logs, and boot persistence.

## Homebrew Service

On the Mac mini, install and run Runtime through Homebrew:

```bash
brew install zknicker/tavern/tavern-runtime
brew services start tavern-runtime
```

The formula should run:

```bash
tavern serve
```

Use Homebrew for lifecycle:

```bash
brew services stop tavern-runtime
brew services restart tavern-runtime
brew upgrade tavern-runtime
```

Or use the Tavern CLI wrappers:

```bash
tavern update
tavern restart
```

## Configuration

Runtime defaults to local-only binding:

```bash
TAVERN_RUNTIME_HOST=127.0.0.1
TAVERN_RUNTIME_PORT=18790
TAVERN_RUNTIME_ROOT=~/.tavern/runtime
```

For a server that accepts app connections from another machine, set the host in
the service environment:

```bash
TAVERN_RUNTIME_HOST=0.0.0.0
TAVERN_RUNTIME_PORT=18790
```

The app stores a Runtime URL such as:

```txt
http://mac-mini.local:18790
```

Tavern does not enforce a network topology. Operators can use LAN DNS,
Tailscale, a reverse proxy, or another trusted network path.

Change `TAVERN_RUNTIME_PORT` only when the app Runtime URL uses the same port.
Managed OpenClaw keeps its own Gateway port, which defaults to `18789`.

## Version Match

For now, Tavern App and Tavern Runtime must use the exact same release version.
The app blocks normal dashboard use when the connected Runtime version differs
and shows the expected version on the onboarding-style Runtime screen.

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

The Homebrew tap is maintained as part of Tavern. Runtime deployment changes in
this repository must keep the tap formula and tap README current in the same
release work.

The tarball contains:

```txt
bin/tavern-runtime
bin/tavern
share/tavern/openclaw-plugins/
share/tavern/node_modules/@tavern/sdk/
```

The bundled plugin sources are synced into `~/.tavern/openclaw-plugins/` at
Runtime startup, then linked to the managed OpenClaw install.
