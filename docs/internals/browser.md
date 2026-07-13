---
summary: Browser Plugin internals for managed Chrome supervision, the launch contract, profiles, guarded recovery, and agent-browser forwarding.
read_when:
  - changing browser supervision, Chrome launch flags, profile handling, or recovery policy
  - changing the browser tool, command serialization, or the managed Browser skill sync
  - debugging an unavailable or degraded plugin.browser capability
---

# Browser

Tavern Runtime supervises one visible Google Chrome and exposes it to granted
agents as the `browser` tool. The implementation lives in
`apps/runtime/src/plugins/browser/` with plugin glue in
`apps/runtime/src/plugins/browser.ts`. It ports the proven BrowserHost
supervision behavior into Runtime; there is no separate browser-management
product, daemon, HTTP surface, or release pipeline.

## Managed Chrome

* Version one detects Google Chrome Stable at fixed macOS bundle locations
  only. Zero installations produce an unavailable `plugin.browser` capability
  with a direct installation reason. Non-macOS hosts report Browser as
  unavailable without blocking any other Runtime feature.
* `profileName` is a validated slug naming a Tavern-owned Chrome user-data
  directory under `~/.tavern/browser/profiles/<profileName>` (root overridable
  with `TAVERN_BROWSER_HOME`). Chrome's internal profile directory stays
  `Default`. Profile directories are durable machine state: upgrades, Plugin
  disablement, and profile switching never delete them.
* The managed launch contract pins identity-affecting flags: an OS-selected
  CDP port (`--remote-debugging-port=0`, discovered via `DevToolsActivePort`),
  the user-data directory, `--password-store=basic`, `--use-mock-keychain`,
  `--disable-skia-graphite`, and a fixed argument set
  (`launch-contract.ts`). The cookie-encryption mode is recorded in a
  `<profileName>.mode.json` marker beside the profile; an incompatible launch
  is refused rather than silently invalidating cookies.
* Chrome is launched detached. Runtime shutdown or upgrade leaves Chrome
  running; the next boot re-adopts only a process matching the exact managed
  launch contract on Tavern's user-data directory. Personal Chrome processes
  and profiles are never adopted. A pidfile profile lock
  (`<profileName>.lock`) keeps a second Runtime or operator command from
  writing the same profile concurrently.

## Supervision and recovery

* The supervisor (`supervisor.ts`) keeps the seven-state model: `stopped`,
  `starting`, `healthy`, `pressured`, `unresponsive`, `recovering`, and
  `degraded`. Capability mapping: pressured stays healthy with pressure
  metadata; starting/recovering map to degraded; stopped, unresponsive, and
  degraded map to unavailable with the current reason.
* Sustained GPU pressure is reported but never restarts Chrome. Automatic
  recovery requires sustained CDP unresponsiveness (60s window at 15s
  samples), captures evidence in bounded memory, spends a restart budget
  (2 per hour), performs bounded graceful-then-forced shutdown, and verifies
  process, contract, lock, and CDP health after restart. A recovery that
  leaves Chrome dead degrades Browser until an operator restart; exhausting
  the budget degrades with an explicit reason.
* Supervision starts with the Plugin on Runtime boot and never blocks
  startup; failures surface only through `plugin.browser` capability health.

## Agent surface

* Granted agents get one AI SDK tool named `browser` accepting opaque
  `args: string[]`. agent-browser (a pinned npm dependency of Runtime) owns
  the automation verbs; Runtime forwards arguments verbatim under a pinned
  session and a neutralized config, re-attaching to the current CDP endpoint
  before every command (`agent-browser-cli.ts`).
* One process-wide FIFO (`command-queue.ts`) serializes browser commands
  across agents and turns. Active commands inhibit automatic recovery, and
  recovery waits a bounded period for the queue to drain.
* The tool may start a stopped browser. A degraded or unavailable browser
  fails fast with the current capability reason.
* The managed Browser skill is vendored from the installed agent-browser
  package by `scripts/sync-browser-skill.mjs`
  (`bun run sync:browser-skill`), which keeps upstream command vocabulary
  verbatim and rewrites only the invocation surface and shell-only guidance.
  Re-run it after bumping the agent-browser dependency; anchor drift fails
  the sync deliberately.

## Remote surface

Runtime's existing authenticated API is the only remote control plane:
settings (`/plugins/browser/settings`) plus `/plugins/browser/open` and
`/plugins/browser/restart` actions. Browser adds no Unix socket, standalone
HTTP API, or Tailscale endpoint.
