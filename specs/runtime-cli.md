# Tavern Runtime CLI

Normative contract for the `tavern` CLI: a clear banner, generated help,
contextual help on incomplete commands, truthful update/restart flows, and
consistent output without a TUI. The implementation lives in
`apps/runtime/src/cli/`.

## Goals

* Every command and group self-documents: `tavern help`,
  `tavern help <cmd>`, `--help` anywhere, and contextual group help when a
  subcommand is missing.
* `tavern update` / `tavern restart` report the true end state, including the
  staged-but-not-restarted case.
* `tavern status` answers "is this box healthy" in one screen.
* Read commands support `--json`.

## Command Tree

```txt
tavern                      Banner + quick status + command list
tavern serve                Run the foreground Runtime server
tavern status [--json]      Service, version, capability, and engine health
tavern update [--restart] [--verbose]
tavern restart [--no-wait]
tavern engine               Group help (exit 1)
tavern engine status [--json]
tavern engine install
tavern engine clean [--all]
tavern memory               Group help (exit 1)
tavern memory status [--json]
tavern memory list [--json]
tavern memory get <path> [--json]
tavern memory search <query> [--json]
tavern version | -v | --version
tavern help [command]
```

## Global Conventions

* Exit codes: `0` success, `1` operational failure, `2` usage error.
* Usage errors print the failing command's own help section to stderr.
* Unknown commands suggest near matches when one exists.
* `--json` prints exactly one JSON document to stdout, no banner, no color.
* Color and banner only when stdout is a TTY; `NO_COLOR` disables color.
* Errors render as a message plus an optional hint line.
* `update` and `restart` operate on the local Homebrew service and probe the
  local Runtime.
* `status`, `memory`, and other client commands honor `TAVERN_RUNTIME_URL` /
  `--runtime-url`.

## Generated Help

Global help is rendered from the command registry.

```txt
Tavern Runtime v1.4.2

Usage
  tavern <command> [flags]

Server
  serve          Run the foreground Tavern Runtime server

Status
  status         Service, version, capability, and engine health
  version        Print the Runtime version

Maintenance
  update         Stage a Runtime upgrade through Homebrew
  restart        Restart the service and wait for health

Memory
  memory         Browse Memory files (status, list, get, search)

Engine
  engine         Inspect, install, or clean the managed agent engine

Environment
  TAVERN_RUNTIME_URL    Runtime API URL for client commands
  TAVERN_RUNTIME_HOST   Bind host (default 127.0.0.1)
  TAVERN_RUNTIME_PORT   Bind port (default 18790)
  TAVERN_RUNTIME_ROOT   Runtime data root (default ~/.tavern/runtime)
```

`tavern help update` / `tavern update --help` shows summary, usage, flags with
descriptions, and examples. Bare `tavern engine` / `tavern memory` print group
help and exit 1.

## Memory Commands

`tavern memory` commands are thin Runtime clients.

* `status` reports the resolved Memory path, config source, page count,
  `TAXONOMY.md` presence, and filesystem access.
* `list` prints Markdown pages relative to the Memory root.
* `get <path>` prints a page.
* `search <query>` prints lightweight search hits.

Writes and maintenance happen through the managed `memory` skill, not the CLI.

## Status

`tavern status` renders a compact health view:

```txt
Tavern Runtime v1.4.2

  Service     running (homebrew)
  Runtime     v1.4.2 · healthy · http://127.0.0.1:18790
  Binary      v1.4.2 · up to date

Capabilities
  ● Codex OAuth          healthy       6m ago
  ● Agent engine API     unavailable   2m ago — Managed agent engine API is not reachable.
  ◐ Memory               degraded      just now — Managed Memory skill has not been prepared.

Engine
  Pin         5937b95 (pinned)
  Resolved    ~/.tavern/engine/ed711e.../agent-engine (managed)
```

`--json` emits one object with `binary`, `service`, `runtime`,
`capabilities`, and `engine` keys.

## Architecture

`apps/runtime/src/cli/` owns:

| File | Responsibility |
| --- | --- |
| `main.ts` | Entry: parse argv, dispatch via registry, top-level error to exit code |
| `registry.ts` | Command metadata, help ordering, command lookup |
| `parse.ts` | Flag/positional validation against a command spec |
| `help.ts` | Render global, group, and per-command help from the registry |
| `ui.ts` | ANSI palette, banner, headings, aligned rows, error/hint |
| `runtime-probe.ts` | Typed local-runtime probes with timeouts |
| `commands/status.ts` | `tavern status` |
| `commands/update.ts` | `tavern update` |
| `commands/restart.ts` | `tavern restart` |
| `commands/memory.ts` | `tavern memory ...` subcommands |
| `commands/engine.ts` | `tavern engine ...` subcommands |

## Acceptance Criteria

* Bare `tavern` shows banner + status line + commands and does not start the
  server.
* `tavern engine` prints engine group help and exits 1; same for `memory`.
* `tavern updte` suggests `update`, exits 2.
* `tavern update` detects the staged-but-not-restarted case and says to run
  `tavern restart`.
* `tavern restart` only reports success after observing `/health` healthy.
* `tavern -v` prints the bare version string.
* All read commands support `--json`.
* No new dependencies; binary still builds via `bun build --compile`.
* User-facing CLI copy says "agent engine"; runtime-provided capability
  display names render as-is.
