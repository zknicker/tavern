# Tavern Runtime CLI

Normative contract for the `tavern` CLI: a clear banner, generated help,
contextual help on incomplete commands, truthful update/restart flows, and
consistent output — without a TUI. The implementation lives in
`apps/runtime/src/cli/`.

## Goals

- Every command and group self-documents: `tavern help`, `tavern help <cmd>`,
  `--help` anywhere, and contextual group help when a subcommand is missing.
- `tavern update` / `tavern restart` report the true end state, including the
  staged-but-not-restarted case.
- A `tavern status` command that answers "is this box healthy" in one screen.
- Consistent exit codes, `--json` on every read command, styled human output.

## Non-goals

- No TUI, no interactive wizards beyond a single y/N restart prompt.
- No new runtime dependencies. All styling is hand-rolled ANSI; everything must
  survive `bun build --compile`.
- No changes to the runtime HTTP update flow consumed by the desktop app
  (`apps/runtime/src/tavern/update.ts`), except where noted for parity.

## Hard constraints

- Zero new packages in `apps/runtime/package.json`.
- Files stay under 300 LoC; split before mixing concerns.
- User-facing copy never names Hermes. Say "agent engine". Internal
  identifiers, env vars, and file paths keep Hermes naming (Coding Rule 11).
- Keep startup status logging in `serve` intact (`log.info('Tavern Runtime
  starting')` etc.).
- TypeScript strict, kebab-case files, vitest colocated tests.
- The `tavern-runtime` alias binary must behave identically to `tavern`.

## CLI contract

### Command tree

```
tavern                      Banner + quick status + command list (no longer aliases serve)
tavern serve                Run the foreground Runtime server (unchanged semantics)
tavern status [--json]      One-screen health: service, versions, capabilities, engine
tavern update [--restart] [--verbose]
tavern restart [--no-wait]
tavern engine               Group help (exit 1)
tavern engine status [--json]
tavern engine install
tavern engine clean [--all]
tavern cortex               Group help (exit 1)
tavern cortex status|topics|list|get|search   (existing flags unchanged)
tavern version | -v | --version    Bare version string (script-stable)
tavern help [command]       Generated help
```

### Global conventions

- Exit codes: `0` success, `1` operational failure, `2` usage error.
- Usage errors print the failing command's own help section to stderr.
- Unknown commands suggest near matches (Levenshtein distance ≤ 2):
  `Unknown command 'updte'. Did you mean 'update'?` Exit 2.
- `--json` prints exactly one JSON document to stdout, no banner, no color.
- Color and banner only when stdout is a TTY; `NO_COLOR` disables color.
  Non-TTY output is plain text with the same content.
- Errors render as a message plus an optional hint line:
  `✗ Runtime is not reachable at http://127.0.0.1:18790` /
  `  ↳ Is the service running? Try 'tavern status'.`
- `update` and `restart` always operate on the local brew service and probe the
  local runtime (`http://127.0.0.1:<TAVERN_RUNTIME_PORT|18790>`). `status` and
  `cortex` honor `TAVERN_RUNTIME_URL` / `--runtime-url`.

### Bare `tavern`

Banner (name, version, one-line tagline; ≤ 6 lines, accent color), then a
single status line, then the command list from the registry, then
`Run 'tavern help <command>' for details.` Exit 0.

The status line probes the local runtime with a short timeout (~750 ms):

- reachable, versions match: `● Runtime v1.4.2 · healthy · http://127.0.0.1:18790`
- reachable, binary newer:   `● Runtime v1.4.0 · binary v1.4.2 staged — run 'tavern restart'`
- unreachable:               `○ Runtime not running · 'brew services start tavern-runtime'`

Safety: the brew formula already runs `tavern serve` explicitly
(`scripts/release/publish-homebrew-formula.mjs:89`). The dev launchd plist
`apps/runtime/launchd/com.tavern.runtime.plist` runs the bare binary and MUST
gain a `serve` argument in the same change.

### `tavern help` (generated)

Rendered from the command registry — never a hand-maintained string. Layout:

```
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

Cortex
  cortex         Browse the Cortex knowledge base (status, topics, list, get, search)

Engine
  engine         Inspect, install, or clean the managed agent engine

Environment
  TAVERN_RUNTIME_URL    Runtime API URL for client commands
  TAVERN_RUNTIME_HOST   Bind host (default 127.0.0.1)
  TAVERN_RUNTIME_PORT   Bind port (default 18790)
  TAVERN_RUNTIME_ROOT   Runtime data root (default ~/.tavern/runtime)
```

`tavern help update` / `tavern update --help` shows summary, usage, flags with
descriptions, and 1–3 examples. Bare `tavern engine` / `tavern cortex` print
the group help (subcommands + examples) and exit 1.

### `tavern update`

1. If `brew` is unavailable, fail: `✗ Homebrew is required to update the
   Runtime.` Exit 1.
2. Detect up-to-date BEFORE upgrading (e.g. `brew outdated tavern-runtime` —
   verify exact flag/exit behavior during implementation). If current:
   `✓ Already up to date (v1.4.2)` and still run step 5's version comparison,
   because "formula current" does not imply "running process current" — this is
   the exact incident that motivated this spec.
3. Run `brew update` then `brew upgrade tavern-runtime` with output captured,
   not `stdio: 'inherit'`. Show a short progress line; dump captured output
   only on failure or with `--verbose`. (This also kills the doubled
   `already installed` warning noise.)
4. Best-effort engine pre-stage, matching the HTTP flow in
   `apps/runtime/src/tavern/update.ts:40`: run
   `"$(brew --prefix)/bin/tavern" engine install`; on failure print a warning
   that restart-time setup will install it.
5. Read the staged binary version by spawning
   `"$(brew --prefix)/bin/tavern" --version` (the in-process version is
   whatever binary the user invoked, which may be pre-upgrade). Probe the local
   runtime's `GET /update/status` → `currentVersion`.
   - Runtime unreachable: `✓ Staged v1.4.2. Runtime is not running — start it
     with 'brew services start tavern-runtime'.` Exit 0.
   - Versions equal: `✓ Runtime is up to date and running v1.4.2.` Exit 0.
   - Running < staged: `✓ Staged v1.4.2 — runtime is still running v1.4.0.`
     With `--restart`, or on interactive TTY after a `Restart now? [y/N]`
     confirmation, run the restart flow below. Otherwise print
     `Run 'tavern restart' to cut over.` Exit 0.

### `tavern restart`

1. `brew services restart tavern-runtime` (captured output).
2. Unless `--no-wait`: poll `GET /health` on the local runtime every 500 ms,
   up to 60 s. On healthy, read `GET /update/status` and confirm:
   `✓ Runtime healthy · v1.4.2`.
3. On timeout: exit 1 with the service state (`brew services info
   tavern-runtime --json`) and a hint pointing at the brew service log.
   Never print success without observing health.

### `tavern status`

Single screen, all sections tolerant of partial failure (an unreachable
runtime still shows service + binary + engine sections):

```
Tavern Runtime v1.4.2                        ← staged/installed binary version

  Service     running (homebrew)
  Runtime     v1.4.2 · healthy · http://127.0.0.1:18790
  Binary      v1.4.2 · up to date

Capabilities
  ● Codex OAuth          healthy       6m ago
  ● Agent engine API     unavailable   2m ago — Managed agent engine API is not reachable.
  ◐ Cortex wiki          degraded      just now — Managed wiki skill has not been prepared.
  …

Engine
  Pin         c986377 (pinned)
  Resolved    ~/.tavern/engine/c986377…/hermes-agent/venv/bin/hermes (managed)
```

Sources: own `package.json` version for the binary; `brew services info
tavern-runtime --json` for service state; `GET /health` + `GET /update/status`
for liveness and running version; `GET /capabilities` for the capability rows
(render `displayName`, `state`, relative `updatedAt`, `reason` as provided by
the runtime — do not rename runtime-owned copy in the CLI); the local engine
resolution from `apps/runtime/src/hermes/engine.ts` for the Engine section.
When running < binary, the Runtime line becomes
`v1.4.0 · healthy — binary v1.4.2 staged, run 'tavern restart'`.
`--json` emits one object with `binary`, `service`, `runtime`, `capabilities`,
`engine` keys. `tavern engine status` remains the detailed engine view.

## Architecture

New directory `apps/runtime/src/cli/`:

| File | Responsibility |
| --- | --- |
| `main.ts` | Entry: parse argv, dispatch via registry, top-level error → exit code |
| `registry.ts` | `CliCommand` type + the registered command list; help/section ordering |
| `parse.ts` | Flag/positional validation against a command's declared spec; suggestions |
| `help.ts` | Render global help, group help, per-command help from the registry |
| `ui.ts` | ANSI palette (TTY + `NO_COLOR` aware), banner, headings, aligned rows, dots, error/hint |
| `brew.ts` | Captured-output brew invocations: update, upgrade, outdated, services restart/info |
| `runtime-probe.ts` | Typed local-runtime probes: health, update status, capabilities, with timeouts |
| `commands/serve.ts` | Thin wrapper over the existing server startup in `index.ts` |
| `commands/status.ts` | `tavern status` |
| `commands/update.ts` | `tavern update` |
| `commands/restart.ts` | `tavern restart` |
| `commands/cortex.ts` | Existing cortex subcommands, migrated |
| `commands/engine.ts` | Existing engine subcommands, migrated (logic stays in `hermes/engine-cli.ts` helpers or moves here — whichever keeps files < 300 LoC) |

Registry shape (guide, not gospel):

```ts
interface CliFlag {
    name: string;          // '--json'
    description: string;
    valueName?: string;    // '--topic <topic>'
}

interface CliCommand {
    name: string;          // 'update', 'engine status'
    section: 'Server' | 'Status' | 'Maintenance' | 'Cortex' | 'Engine';
    summary: string;
    usage: string;
    flags: CliFlag[];
    examples: string[];
    run(args: ParsedArgs): Promise<number>;  // returns exit code
}
```

`apps/runtime/src/index.ts` shrinks to: import `cli/main.ts`, dispatch, and
keep the `serve` path (signal handlers, `main()`) where it is or behind
`commands/serve.ts`. The `parseCli` hack that rewrites `cortex`/`engine` into
`serve` + rest (`apps/runtime/src/cli.ts:43`) is deleted.

## Acceptance criteria

- `tavern` (bare, TTY) shows banner + status line + commands; does NOT start
  the server. Brew service and dev plist still start `serve` correctly.
- `tavern engine` prints engine group help and exits 1; same for `cortex`.
- `tavern updte` suggests `update`, exits 2.
- With formula upgraded but old process still running: `tavern update` ends
  with "runtime is still running vX — run 'tavern restart'", and `tavern
  status` shows the staged-binary mismatch. No path prints success while the
  running version is older than the staged binary.
- `tavern restart` only reports success after observing `/health` healthy, and
  prints the new running version.
- `tavern -v` still prints the bare version string.
- All read commands support `--json`; `--json` output contains no ANSI codes.
- No new dependencies; binary still builds via `bun build --compile`; no
  user-facing "Hermes" strings introduced by the CLI (runtime-provided
  capability `displayName`s are rendered as-is).
