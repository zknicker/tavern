---
summary: Managed Hermes runtime workflow for engine resolution and bootstrap install, local startup, state isolation, model config, capability checks, and cold-start verification.
read_when:
  - running or debugging managed Hermes in local Tavern development
  - changing how Runtime resolves, installs, bootstraps, or pins the Hermes engine binary
  - changing the tavern engine CLI, TAVERN_HERMES_ALLOW_SYSTEM, TAVERN_HERMES_AUTO_INSTALL, or the bundled installer
  - changing Hermes startup, dashboard ports, model provider config, Codex auth sync, or Runtime capability checks
  - verifying that multiple Tavern worktrees can run managed Hermes simultaneously
  - cold-start testing a real engine install or the no-co-opt / version-pin guarantees
  - changing the managed Vault skill package or Vault path handling
  - changing managed Hermes live patches
  - changing the managed Cortex wiki skill package or managed wiki crons
---

# Managed Hermes Runtime

Tavern Runtime owns managed Hermes startup for local Tavern work. Do not restart
or deploy to a global `~/.hermes` dashboard when validating this repo.

## Local Startup

Run the full dev stack:

```bash
bun run dev
```

Runtime launches:

```bash
hermes dashboard --no-open --host 127.0.0.1 --port <TAVERN_HERMES_PORT>
```

Runtime resolves the Hermes binary in tiers:

1. `TAVERN_HERMES_BIN` (explicit operator override; fails loudly when broken).
2. The Tavern-managed engine install at `~/.tavern/engine/<pin>/`.
3. System installs (`~/.local/bin/hermes`, Homebrew paths, then `PATH`) **only
   when `TAVERN_HERMES_ALLOW_SYSTEM` is set**. By default this tier is skipped:
   Tavern ignores a user's own Hermes so production runs the supported pin.
4. Bootstrap: Runtime installs the pinned engine itself using a bundled
   snapshot of the official Hermes installer (lean flags: `--non-interactive
   --skip-setup --no-skills --skip-browser`). The pin lives in
   `apps/runtime/src/hermes/engine.ts`; `TAVERN_HERMES_COMMIT` or
   `TAVERN_HERMES_BRANCH` override it. Concurrent startups share one install
   through the `~/.tavern/engine/.install-lock` cross-process lock, and
   installer output streams into the runtime log.

Two independent flags control the lower tiers:

* `TAVERN_HERMES_ALLOW_SYSTEM` — may resolution use a system install (tier 3)?
  Off by default (production runs the pin); the dev stack and e2e set it to `1`.
* `TAVERN_HERMES_AUTO_INSTALL` — may Runtime bootstrap-install (tier 4)? On by
  default; the dev stack sets it to `0`.

So production defaults to `BIN → managed → bootstrap` and never reads or
modifies a user's Hermes. Dev (`ALLOW_SYSTEM=1`, `AUTO_INSTALL=0`) prefers the
managed engine if present, else a system install, and never downloads. When
neither flag's tier applies and nothing is installed, startup reports a
managed-Hermes setup error naming all three remedies. While a bootstrap is
running, the managed Hermes capabilities report "Tavern is setting up the agent
engine". Use `tavern engine status` to see which tier resolved and whether
system installs are allowed.

The bootstrap installer runs with a sandboxed `HOME`
(`~/.tavern/engine/<pin>/.install-home`) because the official installer writes
a `~/.local/bin/hermes` launcher and edits shell rc files from `$HOME`,
ignoring `--dir`. The sandbox contains those writes; a managed install touches
nothing outside `~/.tavern`. Tavern execs the engine's venv binary directly and
never uses the launcher.

Runtime applies Tavern-owned live patches to managed installs before launch.
Patch ids and checksums are recorded in the engine marker, and the detailed
inventory lives in [Hermes Engine Patches](hermes-engine-patches.md). Live
patches do not apply to `TAVERN_HERMES_BIN` or system-tier installs.

Runtime sets `HERMES_DESKTOP=1` for the managed dashboard process. Hermes uses
that flag to start the dashboard cron ticker; without it, cron jobs can be
created and manually triggered, but interval jobs do not fire on schedule.

## State And Ports

Normal Runtime state defaults to:

```text
~/.tavern/runtime/
```

The dev stack uses worktree-isolated state:

```text
~/.tavern/dev/<worktree-id>/tavern.sqlite
~/.tavern/dev/<worktree-id>/runtime/
```

The dev stack derives a stable four-port group from the worktree path by
default:

```text
website
server
Tavern Runtime
managed Hermes
```

Set `TAVERN_DEV_STACK_ID` to choose the state directory name, or
`TAVERN_DEV_PORT_BASE` to choose the first port in the group. Set
`TAVERN_HERMES_PORT` only when a run must use a specific dashboard port.
When `TAVERN_DEV_STACK_ID` is set, the default port group is derived from that
stack id, so multiple worktrees can intentionally share both state and ports.
`bun run dev:shared` uses `TAVERN_DEV_STACK_ID=tavern-shared`.

## Generated Config

Runtime writes the generated managed Hermes config into `HERMES_HOME` through
one entrypoint, `writeManagedHermesConfigFile`
(`apps/runtime/src/hermes/model-config.ts`), which runs the domain-based
composer (`apps/runtime/src/hermes/generated-config.ts`) and the managed
`.env` merge together. It is the only code path that writes `config.yaml`;
every Tavern-owned setting that lands in the file is a domain:

| Domain | Keys | Source of truth |
| --- | --- | --- |
| model | `model.*` | explicit env, saved agent model, or credentialed default route |
| execution | `fallback_providers`, `timezone`, `delegation.*`, `compression.*`, `auxiliary.web_extract.*` | `/execution-settings` store |
| context files | `context_file_max_chars` | fixed managed policy |
| display | `display.tool_progress`, `display.interim_assistant_messages` | fixed managed policy |
| cron | `cron.wrap_response` | fixed managed policy |
| permissions | `approvals.*`, `command_allowlist` | `/permission-settings` store (untouched until first save) |
| agent env | arbitrary non-reserved env names | `/agent-env` Vault-backed store |
| connectors | `mcp_servers.<id>` + `TAVERN_MCP_*` env secrets | connector vault records |
| memory | built-in `MEMORY.md` / `USER.md` memory enabled, external provider empty | fixed managed policy |
| plugins | `plugins.enabled` messenger entry | fixed managed policy |

Each domain only sets or deletes its own keys, so operator-managed keys
elsewhere in the file survive every merge. Runtime storage is the source of
truth and the YAML is always derived; settings changes rewrite the file and
schedule a managed Hermes restart. Restarts are coalesced — a burst of saves
produces one restart, debounced and deferred (bounded) while a chat turn is
active (`apps/runtime/src/hermes/restart-coordinator.ts`). Per-agent live settings (name, model,
thinking, appearance) are not config domains — saved values live in the
adapter's configured-agent state and flow through the engine API instead.

Explicit env wins:

```text
TAVERN_HERMES_PROVIDER
TAVERN_HERMES_MODEL
TAVERN_HERMES_BASE_URL
TAVERN_HERMES_API_KEY
```

Without explicit provider/model values, Runtime chooses the first runnable
credentialed route:

1. Codex OAuth when Codex credentials are available.
2. OpenAI API when an OpenAI key is configured.
3. OpenRouter when an OpenRouter key is configured.

When no route is configured, Runtime leaves Hermes without a generated default
model and reports the setup gap through capabilities instead of inventing an
unusable provider.

Startup applies the credentialed route as the engine default without saving it
as user intent. Saved settings stores only carry user/API intent; absence means
Tavern should use the current default. Once the user saves an agent model in
Tavern, that saved model remains the generated default across managed runtime
restarts and app updates. `TAVERN_HERMES_PROVIDER` or `TAVERN_HERMES_MODEL`
still explicitly forces a route.

When Runtime resolves a route, Tavern applies it as Hermes's default runtime. It does not set
`model.openai_runtime: codex_app_server`; that remains a Hermes opt-in.

Runtime also syncs Vault-backed Codex OAuth material into managed Hermes
`auth.json` when available.

## Managed Vault Package

Runtime packages the Tavern-owned Vault skill with managed Hermes. Before
launch it copies the prompt-visible skill directory to
`HERMES_HOME/skills/vault`.

The Vault path defaults to `~/wiki`. Operators can override it with
`TAVERN_VAULT_PATH`, and users can configure it from Settings -> Vault. Runtime
creates the root and `INDEX.md` when the path is saved, then passes the resolved
path to the engine as `TAVERN_VAULT_PATH`.

### Changing the managed Vault skill

The skill at `apps/runtime/assets/hermes/skills/vault/` is Tavern-owned product
surface. It routes normal wiki work to Obsidian and bounded research folders to
llm-wiki. Runtime does not own wiki maintenance prompts or jobs.

Run `bun run --filter @tavern/runtime test -- src/hermes/managed-vault.test.ts
src/vault` and start the dev stack to verify skill sync.

## Managed Tavern Skill

Runtime installs the `tavern` skill (`apps/runtime/assets/hermes/skills/tavern`)
into `HERMES_HOME/skills/tavern` before launch, alongside the Vault skill. It
carries the agent's product knowledge of Tavern — chat and delivery API
recipes against `TAVERN_RUNTIME_URL`, the automations delivery contract,
read-only self-configuration lookups, and the settings map for directing the
user. Runtime owns the content and refreshes it on every startup; the
generated `AGENTS.md` points the agent at it. The contract lives in
[tavern-skill.md](../../specs/tavern-skill.md).

Runtime writes the managed `vault` and `tavern` skill directories read-only and
the skill text tells agents not to edit them. On the next startup Runtime first
makes the old managed copy replaceable, deletes it, copies the bundled source,
and writes it read-only again. Other skills under `HERMES_HOME/skills` remain
Hermes-owned skill state: hub-installed and agent-created skills stay
agent-editable and, with the default managed home, live under the Runtime root
backup unit across Tavern Runtime updates and Hermes pin changes. Updating
those skills is normal Hermes agent-managed skill work: the agent edits or
merges the source copy, and Runtime only refreshes the visible inventory after
Hermes observes the change.

## Managed Assistant Memory

Runtime configures managed Hermes to use the engine's built-in prompt-time
memory files and no external memory provider:

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  provider: ""
```

Hermes stores compact assistant memory under its managed home as
`memories/MEMORY.md` and `memories/USER.md`. Runtime does not install a memory
plugin, provision Python packages, or write memory-provider env vars. Durable,
inspectable knowledge belongs in Vault.

## Capability Checks

Managed Hermes readiness is split into primitive Runtime capabilities:

| Capability | Healthy when |
| --- | --- |
| `dashboardServer` | Runtime can reach Hermes dashboard status. |
| `apiServer` | Runtime can make an authenticated Hermes REST call. |
| `gateway` | Runtime can open the Hermes Gateway WebSocket. |
| `models` | Runtime can read Hermes model inventory. |
| `skills` | Runtime can read Hermes skill inventory. |

App controls gate on these Runtime capability records, not app-local process
guesses.

## Verification

For lifecycle changes:

```bash
bun run --filter @tavern/runtime typecheck
bun run --filter @tavern/runtime test
bun run --filter @tavern/website test:e2e -- tests/hermes-tavern-chat-contract.spec.ts
```

For e2e contract work, use the default Playwright lane. It starts real managed
Hermes and mocks only the model-provider HTTP endpoint.

### Slow skill search / empty featured skills

Skill hub search should be sub-second: the engine serves it from a centralized
skills index (~35 MB JSON, cached 6 hours under `skills/.hub/index-cache/`).
If every search takes ~30 seconds and the Add skill featured grid is empty, the
index is failing to load and the engine is falling back to live GitHub/ClawHub
fan-out. Known cause on system Hermes installs (`TAVERN_HERMES_ALLOW_SYSTEM=1`):
a venv with `brotlicffi` hits an httpx brotli decode bug on the index download.
Fix by installing the `brotli` package into that venv
(`~/.hermes/hermes-agent/venv/bin/pip install brotli`); httpx prefers it and the
index loads. Managed engine installs ship without either brotli module and are
not affected.

## Cold-Start Verification

The unit and e2e lanes mock or reuse an existing Hermes; they do not exercise a
real bootstrap install. Run this manual check before any release that changes
engine resolution, the bundled installer snapshot, or the pin. It installs a
real engine (~2 GB, several minutes) into a throwaway `HOME`, so it never
touches your own install.

```bash
TMP=$(mktemp -d)
# Decoy standing in for a user's existing install; must stay untouched.
mkdir -p "$TMP/.local/bin"
printf '#!/usr/bin/env bash\necho original\n' > "$TMP/.local/bin/hermes"
chmod 755 "$TMP/.local/bin/hermes"
printf '# original\n' > "$TMP/.zshrc"
shasum "$TMP/.local/bin/hermes" "$TMP/.zshrc"   # record baseline

cd apps/runtime
HOME="$TMP" bun src/index.ts engine status      # expect: System installs  ignored
HOME="$TMP" bun src/index.ts engine install     # real install into $TMP/.tavern
HOME="$TMP" bun src/index.ts engine status      # expect: Resolved ... (managed)
```

Confirm:

* The managed binary runs:
  `"$TMP"/.tavern/engine/<pin>/hermes-agent/venv/bin/hermes --version`.
* The decoy `"$TMP"/.local/bin/hermes` and `"$TMP"/.zshrc` checksums are
  **unchanged** — the install never co-opts a user's launcher or shell config.

**Node-less host check:** the bundled installer skips installing Node when the
host already has one, so a machine with system Node does not exercise Node
bundling. To verify the bundled-Node path, run the install where no `node` is on
`PATH`, then start the runtime and confirm the dashboard reaches healthy.
`buildHermesDashboardEnv` prepends `HERMES_HOME/node/bin` to `PATH` so the
managed dashboard resolves the bundled Node; this check confirms that holds end
to end.

Clean up with `rm -rf "$TMP"`.

## Related Docs

* [Development](development.md)
* [Testing](testing.md)
* [Runtime capabilities](../internals/runtime-capabilities.md)
* [Tavern Hermes Runtime Adapter](../internals/tavern-hermes-runtime-adapter.md)
