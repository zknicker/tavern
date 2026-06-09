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
tavern cortex topics
tavern cortex list --topic project-wiki
tavern cortex get project-wiki wiki/index.md
tavern cortex search "theme across project notes"
tavern cortex status
tavern update
tavern restart
tavern --version
tavern --help
```

`serve` runs the foreground Runtime process. It starts the Runtime HTTP and
WebSocket API, Runtime storage, managed Hermes dashboard/API/Gateway, Cortex
wiki reads, and Runtime jobs. It logs to stdout and stderr, and exits on
`SIGINT` or `SIGTERM`.

`cortex` commands are thin CLI clients for the managed Runtime. They require a
running Runtime and use `TAVERN_RUNTIME_URL`, or `http://127.0.0.1:18790` by
default. They browse the resolved llm-wiki hub; writes and maintenance happen
through llm-wiki skills launched from Tasks or Runtime crons.

`tavern` is the preferred CLI. `tavern-runtime` remains as a compatibility
alias.

`update` shells out to Homebrew and stages the newest Runtime package without
restarting the running service. `restart` restarts the Homebrew service and is
the explicit cutover step. Use Homebrew directly for stop, logs, and boot
persistence.

Runtime updates are two-phase:

1. **Stage.** Tavern installs the new Runtime package while the old Runtime
   process stays online.
2. **Cut over.** Tavern restarts Runtime only after the desktop update is also
   ready, then waits for Runtime health before restarting the app when an app
   update is staged.

This keeps Hermes-backed features online during download/install work and
prevents the old app from sitting against a newly restarted incompatible
Runtime.

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
TAVERN_RUNTIME_ROOT=~/.tavern-hermes/runtime
TAVERN_HERMES_PORT=9119
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
Managed Hermes dashboard, API, and Gateway share `TAVERN_HERMES_PORT`, which
defaults to `9119`.

## Version Match

Tavern App and Tavern Runtime do not need exact release-version lockstep. The
app declares its Runtime compatibility floor in `apps/website/package.json` at
`tavern.runtime.minimumVersion`.

The app accepts a Runtime when the Runtime version is exactly the app version,
or when it is in the same Runtime API epoch as the floor and is greater than or
equal to the floor. The Runtime API epoch is `major.minor`; patch releases inside
that epoch are compatible unless a release raises the floor.

The app blocks normal dashboard use only when the connected Runtime is below the
floor or from a different Runtime API epoch. The onboarding-style Runtime screen
shows the app version, the minimum Runtime version, and the connected Runtime
version. The updater control stages any required Runtime update first, downloads
the app update when needed, then exposes one restart action for the final
cutover.

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
share/tavern/node_modules/@tavern/sdk/
```

Runtime resolves the Hermes CLI from `TAVERN_HERMES_BIN`, known installer paths,
or `PATH`. Set `TAVERN_HERMES_BIN` in the Homebrew service environment when the
service should use a specific Hermes install.
