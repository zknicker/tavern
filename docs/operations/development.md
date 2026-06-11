---
summary: Local development workflow for managed dev stack startup, Hermes runtime state, and verification pointers.
read_when:
  - running Tavern locally or changing managed runtime development workflow
  - changing local stack startup, ports, or developer verification
  - changing the dev-stack Hermes engine defaults (TAVERN_HERMES_ALLOW_SYSTEM, TAVERN_HERMES_AUTO_INSTALL)
---

# Development

## Local Stack

Run the full managed development stack:

```bash
bun run dev
```

This starts Tavern Runtime, managed Hermes, the local app backend, and the
website dev server.

The dev stack uses worktree-isolated development state by default:

```txt
~/.tavern/dev/<worktree-id>/tavern.sqlite
~/.tavern/dev/<worktree-id>/runtime
```

The stack derives a stable port group from the worktree path. Website, server,
Tavern Runtime, and managed Hermes each get one port from that group, so multiple
Tavern worktrees can run at the same time without sharing Runtime state or a
managed Hermes dashboard. This keeps the managed dev Runtime out of the packaged
app's `~/.tavern/tavern.sqlite` state and away from pre-Hermes dev databases.

Set `TAVERN_DEV_STACK_ID` to choose the state directory name, or
`TAVERN_DEV_PORT_BASE` to choose the first port in the four-port group:

```bash
TAVERN_DEV_STACK_ID=hermes-a TAVERN_DEV_PORT_BASE=43000 bun run dev
```

That example uses ports `43000` through `43003`. Set `DATABASE_PATH` or
`TAVERN_RUNTIME_ROOT` explicitly when a dev run should use a specific app
database or Runtime root.

Set `TAVERN_HERMES_HOME`, `TAVERN_HERMES_BIN`, `TAVERN_HERMES_HOST`,
`TAVERN_HERMES_PORT`, or `TAVERN_HERMES_TOKEN` when a dev run should use a
specific Hermes install or dashboard process.

The dev stack sets `TAVERN_HERMES_ALLOW_SYSTEM=1` and
`TAVERN_HERMES_AUTO_INSTALL=0` by default: dev runs resolve the machine's
existing Hermes install and never download a managed engine. (Production does
the opposite — it ignores system installs and runs the pinned managed engine.)
On a dev machine without Hermes, set `TAVERN_HERMES_AUTO_INSTALL=1` to let
Runtime bootstrap the pinned engine into `~/.tavern/engine/` once, shared
across worktrees.

The Runtime API requires a bearer token. The dev stack reads (or creates) the
token from `<runtime root>/tavern.json` — the same config file the Runtime and
the `tavern` CLI resolve — and hands it to every stack process, so the token
is stable per worktree across sessions. To use the CLI against a running dev
stack, point it at the same state:

```bash
TAVERN_RUNTIME_ROOT=~/.tavern/dev/<worktree-id>/runtime \
TAVERN_RUNTIME_PORT=<runtime port> bun apps/runtime/src/index.ts status
```

`TAVERN_RUNTIME_TOKEN` overrides the file for CI or reproducible setups.

## Claude Code Previews

`.claude/launch.json` tells Claude Code's browser preview which port to attach
to. It is gitignored, not committed, because the port is per-checkout. A
`SessionStart` hook in `.claude/settings.json` runs
`scripts/generate-claude-launch.mjs`, which writes the file from the same
`resolveDevPorts` group the dev stack uses — so the preview always points at the
website port that `bun run dev:web:runtime` actually binds. Nothing to do by
hand; the file regenerates each session.

## Shutdown

From the terminal, stop the dev stack with `Ctrl+C` or `kill -TERM <dev-stack-pid>`.
The stack sends `SIGTERM` to every managed child process immediately, then waits
for each one to exit before returning control to the shell. Runtime owns managed
Hermes shutdown, so the Runtime process logs while it waits for Hermes to exit.

In desktop mode, quitting the app with `Cmd+Q` also lets the stack unwind. The
desktop process exits first, then the stack signals the remaining website, app
backend, Runtime, and managed Hermes processes.

## Verification

Use [Testing](testing.md) for test lanes and e2e rules.
