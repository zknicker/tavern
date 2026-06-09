---
summary: Managed Hermes runtime workflow for local startup, state isolation, model config, capability checks, and verification.
read_when:
  - running or debugging managed Hermes in local Tavern development
  - changing Hermes startup, dashboard ports, model provider config, Codex auth sync, or Runtime capability checks
  - verifying that multiple Tavern worktrees can run managed Hermes simultaneously
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

Runtime resolves the Hermes binary from `TAVERN_HERMES_BIN`, known install
paths, or `PATH`. If no executable is found, startup reports a managed-Hermes
setup error instead of spawning a missing command in a loop.

Runtime sets `HERMES_DESKTOP=1` for the managed dashboard process. Hermes uses
that flag to start the dashboard cron ticker; without it, cron jobs can be
created and manually triggered, but interval jobs do not fire on schedule.

## State And Ports

Normal Runtime state defaults to:

```text
~/.tavern-hermes/runtime/
```

The dev stack uses worktree-isolated state:

```text
~/.tavern-hermes/dev/<worktree-id>/tavern.sqlite
~/.tavern-hermes/dev/<worktree-id>/runtime/
```

The dev stack derives a stable four-port group from the worktree path:

```text
website
server
Tavern Runtime
managed Hermes
```

Set `TAVERN_DEV_STACK_ID` to choose the state directory name, or
`TAVERN_DEV_PORT_BASE` to choose the first port in the group. Set
`TAVERN_HERMES_PORT` only when a run must use a specific dashboard port.

## Model Config

Runtime writes managed Hermes model config into `HERMES_HOME`.

Explicit env wins:

```text
TAVERN_HERMES_PROVIDER
TAVERN_HERMES_MODEL
TAVERN_HERMES_BASE_URL
TAVERN_HERMES_API_KEY
```

Without explicit provider/model values, Runtime prefers OpenRouter only when an
OpenRouter key exists and no OpenAI key exists. Otherwise it defaults to the
Codex harness:

```text
provider = openai-codex
model    = CODEX_MODEL or gpt-5.4-mini
```

Runtime also syncs Vault-backed Codex OAuth material into managed Hermes
`auth.json` when available.

## Managed Wiki Package

Runtime packages the Tavern-adapted llm-wiki skill with managed Hermes. Before
launch it copies the prompt-visible workflow skill directory to
`HERMES_HOME/skills/wiki`.

The wiki hub defaults to `TAVERN_RUNTIME_ROOT/wiki`. Operators can override it
with `TAVERN_WIKI_HUB_PATH` or `TAVERN_CORTEX_WIKI_PATH`. Runtime creates the
hub skeleton and passes the resolved path to Hermes as `TAVERN_WIKI_HUB_PATH`.

## Managed Memory Provider

Runtime configures managed Hermes to use the Mnemosyne memory provider:

```yaml
memory:
  provider: mnemosyne
  memory_enabled: false
  user_profile_enabled: false
```

Runtime also materializes a managed `HERMES_HOME/plugins/mnemosyne` discovery
shim and provisions `mnemosyne-hermes` into the Hermes Python environment before
starting the dashboard. Release artifacts carry a bundled Mnemosyne wheelhouse
under `runtime-assets/python/mnemosyne`; source runs fall back to the Python
package index when the wheelhouse is absent. Operators do not run `pip`,
`pipx`, or `hermes memory setup` for the managed instance.

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

## Related Docs

* [Development](development.md)
* [Testing](testing.md)
* [Runtime capabilities](../internals/runtime-capabilities.md)
* [Tavern Hermes Runtime Adapter](../internals/tavern-hermes-runtime-adapter.md)
