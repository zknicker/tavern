---
summary: Production Tavern Runtime deployment for a Mac mini using the runtime CLI, Homebrew service management, runtime URL configuration, and trusted-network assumptions.
read_when:
  - deploying Tavern Runtime to a Mac mini or always-on host
  - changing runtime CLI commands, Homebrew service packaging, runtime host/port defaults, or app runtime URL setup
  - changing how a deployed host acquires the Hermes engine (managed install, bootstrap, version pin, or the no-co-opt guarantee)
  - separating Tavern desktop app releases from Tavern Runtime releases
---

# Runtime Deployment

Tavern Runtime is an always-on server process. The desktop app connects to its
configured Runtime URL.

## Runtime CLI

Keep the CLI small:

```bash
tavern                 # banner, live runtime status line, command list
tavern serve
tavern status [--json] [--runtime-url <url>]
tavern token [--json]
tavern vault list
tavern vault get MEMORY.md
tavern vault search "theme across project notes"
tavern vault status
tavern engine status
tavern engine install
tavern engine clean
tavern update [--restart] [--verbose]
tavern restart [--no-wait]
tavern --version
tavern help [command]
```

Bare `tavern` does not start the server; it prints the banner, a one-line
runtime status, and the command list. Help is generated from the command
registry: `tavern help <command>` and `--help` work on every command, bare
`tavern engine` / `tavern vault` print group help, and unknown commands get
a did-you-mean suggestion. Exit codes are `0` success, `1` operational
failure, `2` usage error. Read commands support `--json`.

`serve` runs the foreground Runtime process. It starts the Runtime HTTP and
WebSocket API, Runtime storage, managed Hermes dashboard/API/Gateway, Memory
reads, and Runtime jobs. It logs to stdout and stderr, and exits on
`SIGINT` or `SIGTERM`. The Homebrew service and the dev launchd plist invoke
`tavern serve` explicitly.

`status` is the one-screen host health view: Homebrew service state, the
running Runtime version versus the installed binary version (including the
"staged, run 'tavern restart'" case), capability health with reasons, and the
resolved engine. With `--runtime-url` it inspects a remote Runtime; the
local-only rows are then labeled `(local)` and the staged-binary hint is
suppressed.

`vault` commands are thin CLI clients for the managed Runtime. They require a
running Runtime and use `TAVERN_RUNTIME_URL`, or `http://127.0.0.1:18790` by
default. They browse the resolved Memory root; writes and maintenance happen
through the managed `memory` skill. When the Runtime is unreachable they fail
with a pointer to `tavern status`.

`tavern` is the preferred CLI. `tavern-runtime` remains as a compatibility
alias.

`engine` commands manage the Hermes engine that powers the assistant, without
needing a running Runtime. `status` shows the resolved binary and which tier
won (configured, managed, or system), the engine pin, and installed pins.
`install` pre-provisions the pinned engine into `~/.tavern/engine/<pin>/`
(idempotent; streams installer output). `clean` removes engine installs for
other pins; `--all` removes every install.

`update` shells out to Homebrew and stages the newest Runtime package without
restarting the running service, then best-effort pre-installs the staged
Runtime's pinned engine so the cutover restart does not wait on an engine
download. It prints phase progress for Homebrew checks, package staging, engine
pre-stage, and version checks; `--verbose` also prints captured Homebrew output.
It always ends with a version verdict: it compares the staged binary version
against the running Runtime and says explicitly when a restart is still required
("formula up to date" never implies the running process is). `--restart`, or a
confirmation prompt on a TTY, cuts over immediately.
`restart` restarts the Homebrew service, waits for Runtime health, and
confirms the new running version; it never reports success without observing
health (`--no-wait` skips the wait). Use Homebrew directly for stop, logs, and
boot persistence.

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

On the Mac mini, installing Runtime through Homebrew is the only install step;
the first start bootstraps the pinned Hermes engine automatically (git is the
only prerequisite, provided by the macOS command line tools):

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

Every non-health Runtime HTTP request and WebSocket upgrade requires a bearer
token. Tavern Runtime generates the token on first start and stores it in the host
config file `<runtime-root>/tavern.json` (`token` key, mode 0600). The Tavern App reads the token
from the connection record and sends it as `Authorization: Bearer <token>` on
every request.

**Override**: set `TAVERN_RUNTIME_TOKEN` in the Runtime process environment to
use a fixed token instead of the file-backed one. Set the same value in the App
Server environment as `TAVERN_RUNTIME_TOKEN` so the server can authenticate.
The dev stack and e2e harness set a shared token automatically.

The health route (`GET /health`) remains unauthenticated so the app can probe
reachability before pairing.

### Pairing the app to a remote Runtime

When the Runtime host is separate from the machine running the Tavern app (for
example a Mac mini on Tailscale), pair them by copying the token from the host
to the app:

1. On the Runtime host, run:
   ```bash
   tavern token
   ```
   The command prints the current bearer token — the same value Runtime enforces.
2. In the Tavern app, paste the token into the **Runtime token** field in
   **Settings → Tavern Runtime**, or during the onboarding flow when first
   connecting to a remote Runtime.

The token is stable unless you rotate it manually by editing the `token` key
in `<runtime-root>/tavern.json` (or deleting the file to regenerate). A URL-only re-save in the app does not
clear a stored token; only entering a new token value changes it.

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
share/tavern/runtime-assets/
```

`runtime-assets/` carries the bundled Hermes installer snapshot, so first-run
engine setup needs no operator Hermes work.

By default, production **runs the pinned engine and ignores any Hermes already
on the host** — a user's `~/.local/bin/hermes`, `~/.hermes`, shell config, and
Hermes venv are never read, modified, or executed. Runtime resolves
`TAVERN_HERMES_BIN` first, then the managed engine at `~/.tavern/engine/<pin>/`,
and bootstraps the pinned engine when neither is present. This guarantees the
deployment runs the supported Hermes version.

Escape hatches: set `TAVERN_HERMES_BIN` in the Homebrew service environment to
run a specific install; set `TAVERN_HERMES_ALLOW_SYSTEM=1` to let resolution use
a system Hermes install instead of the managed engine; set
`TAVERN_HERMES_AUTO_INSTALL=0` to forbid bootstrap (startup then fails loudly if
no engine is available rather than downloading).

Disk note: on a host that already has Hermes, the managed engine is a second,
Tavern-owned install under `~/.tavern/engine/<pin>/` (repo + venv + bundled
node, ~1GB+). That duplication is the cost of the version guarantee. Use
`TAVERN_HERMES_ALLOW_SYSTEM=1` if you would rather reuse the host's install and
accept that Tavern no longer pins the version.
