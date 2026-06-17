---
summary: Runtime admin and control routes for health, capabilities, events, managed Hermes, sessions, cron, skills, models, bindings, and files.
read_when:
  - changing Tavern Runtime health, capabilities, admin, or control routes
  - changing managed Hermes, cron, skills, sessions, models, or memory runtime APIs
  - changing packages/tavern-api/src/runtime contracts
---

# Admin API

The Admin API is part of the Tavern API.

Tavern App, managed Hermes, automations, local tools, and tests use it to
inspect runtime health, manage runtime-owned records, and control local runtime
capabilities. It is not a second product API.

## In The Box

* **Capabilities.** Runtime readiness, identity, version, compatibility, and
  feature health.
* **Runtime events.** Recent event lists and websocket notifications for
  operational state.
* **Managed Hermes.** Config and local lifecycle control.
* **Operational records.** Agents, sessions, jobs, cron jobs, cron runs, models,
  skills, bindings, memory status, memory settings, and agent files.
* **Runtime chat relay.** The private websocket Runtime uses for accepted chat
  work and Hermes dispatch. Durable chat history still lives in the Chat API.

## Route Groups

| Group | Routes |
| --- | --- |
| Health and capabilities | `/health`, `/capabilities`, `/capabilities/{id}`, `/capabilities/{id}/refresh`, `/capabilities/refresh` |
| Runtime update | `/update/status`, `/update`, `/update/restart` |
| Runtime events | `/events`, websocket `/events` |
| Managed Hermes | `/hermes-config`, `/execution-settings`, `/permission-settings`, `/agent-env` |
| Connectors | `/connectors`, `/connectors/{id}`, `/connectors/{id}/test` |
| Agents and files | `/agents`, `/agents/{id}`, `/agents/{id}/config`, `/agents/{id}/files`, `/agents/{id}/files/{path}` |
| Sessions and execution evidence | `/hermes/sessions`, `/hermes/sessions/previews`, `/hermes/sessions/{sessionKey}/messages`, `/hermes/sessions/{sessionKey}/graph`, `/hermes/sessions/{sessionKey}/prompt`, `/hermes/sessions/{sessionKey}/resync` |
| Jobs | `/jobs`, `/jobs/{slug}`, `/jobs/{slug}/run` |
| Cron | `/cron-jobs`, `/cron-jobs/{id}`, `/cron-jobs/{id}/run`, `/cron-jobs/{id}/runs`, `/cron-runs`, `/cron-runs/{id}` |
| Skills | `/skills`, `/skills/{id}`, `/skills/{id}/config` |
| Skill hub | `/skills/hub/available`, `/skills/hub/preview`, `/skills/hub/scan`, `/skills/hub/install`, `/skills/hub/uninstall`, `/skills/hub/taps`, `/skills/hub/taps/{repo}` |
| Toolset setup | `/toolsets`, `/toolsets/{id}/enabled`, `/toolsets/{id}/config`, `/toolsets/{id}/provider`, `/toolsets/{id}/env`, `/toolsets/{id}/post-setup` |
| MCP servers | `/mcp/servers`, `/mcp/servers/{name}`, `/mcp/servers/{name}/test`, `/mcp/servers/{name}/enabled`, `/mcp/catalog`, `/mcp/catalog/install` |
| Vault, models, and access | `/vault/status`, `/vault/settings`, `/vault/pages`, `/vault/search`, `/models`, `/model-access`, `/model-access/api-key`, `/model-access/oauth/{providerId}/start`, `/model-access/oauth/{providerId}/poll/{sessionId}`, `/model-access/oauth/{providerId}/submit`, `/model-access/oauth/sessions/{sessionId}`, `/model-access/openrouter` |
| Platform bindings | `/bindings`, `/bindings/{id}` |
| Hermes chat projections | `/hermes/chats`, `/hermes/chats/{chatId}/messages` |
| Runtime chat relay | websocket `/chat` |

`POST /jobs/{slug}/run` is the single manual job-run interface. Runtime job
definitions own their payload schema and default input. Vault maintenance is
not a built-in Runtime job; wiki work belongs to agents through the managed
`vault` skill.

`/execution-settings` (GET/PUT) owns Tavern-stored agent execution settings:
the model fallback chain and the agent timezone. Runtime stores the settings,
rewrites the generated managed runtime config, and restarts managed Hermes to
apply them; the PUT response reports whether a restart was scheduled.

`/permission-settings` (GET/PUT) owns Tavern-stored permission policy: the
tool and automation approval modes and the command allowlist. Runtime stores
the policy, rewrites the generated managed runtime config, and restarts
managed Hermes to apply it; live "always" approval answers persisted by the
engine are imported into the visible allowlist.

`/agent-env` (GET/PUT) owns Tavern-stored environment variables for the managed
agent process. Values live in Tavern Vault, reads return only `{name, hasValue}`
masks, and saves rewrite the generated managed env file and restart managed
Hermes to apply them.

`/connectors` owns Tavern-stored MCP server records. Secret env and header
values live in Tavern Vault and are materialized into the generated managed
runtime config as `${ENV}` references backed by the managed env file; reads
return only `{name, hasValue}` masks. Saves and deletes rewrite the generated
config and restart managed Hermes. `POST /connectors/{id}/test` checks command
resolution or URL reachability without touching the running engine.

`/model-access/api-key` writes provider API keys through the managed Hermes
environment API. `/model-access/oauth/{providerId}/start` starts the
provider's Hermes-owned OAuth flow and returns either an auth URL or
device-code instructions. Provider model credentials are Hermes-owned.
Telemetry-only credentials, such as the OpenRouter management key used by
Stats, live with the feature that reads that telemetry.

## Contract Source

| Source | Owns |
| --- | --- |
| `packages/tavern-api/src/runtime/routes.ts` | Admin route names |
| `packages/tavern-api/src/runtime/contracts.ts` | Request and response schemas |
| `packages/tavern-api/src/runtime/model-identity.ts` | Model provider and identity shapes |
| `packages/tavern-api/src/runtime/skills.ts` | Runtime skill file path helpers |
| `apps/runtime/src/tavern/` | Runtime handlers |
| `@tavern/sdk` | Typed client calls over the Tavern API |

## Rules

* **Runtime owns operations.** Health, capabilities, managed Hermes, cron, sessions,
  and skill state come from Tavern Runtime.
* **Runtime owns capabilities.** Runtime stores capability health and exposes
  the capability API. Jobs and app surfaces can use capability health to decide
  whether dependent functionality is available. The app may cache and render
  capability health, but it does not run checks or decide readiness.
* **Runtime update is staged.** `/update` installs the new Runtime package
  without restarting the service. `/update/status` reports the stage state.
  `/update/restart` is the explicit cutover request and restarts the Homebrew
  service only after Tavern is ready to finish the whole app/Runtime update.
* **Read routes are Runtime-backed.** Agent, chat, model, skill, and session
  reads return the latest Runtime SQLite snapshot. Runtime refreshes
  execution-owned records from specific Hermes events. Session update events
  only record the session row they carry; they do not fetch the full transcript
  or graph. Session preview reads are bounded Runtime API calls for index views.
  Skill and model reads may start a background refresh when their stored snapshot
  is missing or stale, but client reads do not synchronously call Hermes.
* **Models come from Hermes.** `/models` exposes the Runtime snapshot of Hermes
  model options as a read-only inventory. Agent model selection uses narrow
  agent mutations that update the managed Hermes config through Runtime, not an
  app-maintained list.
* **Chat stays canonical.** Runtime chat control routes do not replace the
  durable Chat API timeline.
* **Session facts stay execution-owned.** Session messages, graphs, prompts, and
  resync are runtime evidence for an agent execution.
* **The app is a client.** Tavern App may proxy, cache, and present this data,
  but the cross-boundary contract lives in `@tavern/api`.
