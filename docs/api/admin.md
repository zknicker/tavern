---
summary: Runtime admin and control routes for health, capabilities, events, agent execution, sessions, cron, skills, models, bindings, and files.
read_when:
  - changing Tavern Runtime health, capabilities, admin, or control routes
  - changing agent execution, cron, skills, sessions, models, or memory runtime APIs
  - changing packages/tavern-api/src/runtime contracts
---

# Admin API

The Admin API is part of the Tavern API.

Tavern App, automations, local tools, and tests use it to inspect runtime
health, manage runtime-owned records, and control local runtime capabilities.
It is not a second product API.

## In The Box

- **Capabilities.** Runtime readiness, identity, version, compatibility, and
  feature health.
- **Runtime events.** Recent event lists and websocket notifications for
  operational state.
- **Agent execution.** Engine config and local lifecycle control.
- **Operational records.** Agents, sessions, jobs, cron jobs, cron runs, models,
  skills, bindings, memory status, memory settings, and agent files.
- **Runtime chat relay.** The private websocket Runtime uses for accepted chat
  work and agent dispatch. Durable chat history still lives in the Chat API.

## Route Groups

| Group                           | Routes                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Health and capabilities         | `/health`, `/capabilities`, `/capabilities/{id}`, `/capabilities/{id}/refresh`, `/capabilities/refresh`                                                                                                                                                                                                                                    |
| Runtime update                  | `/update/status`, `/update`, `/update/restart`                                                                                                                                                                                                                                                                                             |
| Runtime events                  | `/events`, websocket `/events`                                                                                                                                                                                                                                                                                                             |
| Agent execution                 | `/agent-engine/config`, `/execution-settings`, `/agent-env`                                                                                                                                                                                                                                                                                |
| Plugins                         | `/plugins`, `/plugins/{id}`, `/plugins/merchbase/settings`, `/plugins/merchbase/action`, `/plugins/merchbase/sales/series`                                                                                                                                                                                                                 |
| Agents and files                | `/agents`, `/agents/{id}`, `/agents/{id}/config`, `/agents/{id}/files`, `/agents/{id}/files/{path}`, `/workspace/agents/{id}/files`, `/workspace/agents/{id}/files/{path}`                                                                                                                                                                 |
| Sessions and execution evidence | `/agent/sessions`, `/agent/sessions/previews`, `/agent/sessions/{sessionKey}/messages`, `/agent/sessions/{sessionKey}/graph`, `/agent/sessions/{sessionKey}/prompt`, `/agent/sessions/{sessionKey}/resync`                                                                                                                                 |
| Jobs                            | `/jobs`, `/jobs/{slug}`, `/jobs/{slug}/run`                                                                                                                                                                                                                                                                                                |
| Cron                            | `/cron-jobs`, `/cron-jobs/{id}`, `/cron-jobs/{id}/run`, `/cron-jobs/{id}/runs`, `/cron-runs`, `/cron-runs/{id}`                                                                                                                                                                                                                            |
| Skills                          | `/skills`, `/skills/{id}`, `/skills/{id}/config`                                                                                                                                                                                                                                                                                           |
| Skill hub                       | `/skills/hub/available`, `/skills/hub/preview`, `/skills/hub/scan`, `/skills/hub/install`, `/skills/hub/uninstall`, `/skills/hub/taps`, `/skills/hub/taps/{repo}`                                                                                                                                                                          |
| Tools                           | `/tools`, `/tools/{id}/enabled`, `/tools/{id}/config`, `/tools/{id}/provider`, `/tools/{id}/env`, `/tools/{id}/post-setup`                                                                                                                                                                                                                 |
| MCP servers                     | `/mcp/servers`, `/mcp/servers/{name}`, `/mcp/servers/{name}/test`, `/mcp/servers/{name}/enabled`, `/mcp/catalog`, `/mcp/catalog/install`                                                                                                                                                                                                   |
| Memory, models, and access      | `/vault/status`, `/vault/settings`, `/vault/pages`, `/vault/search`, `/models`, `/model-access`, `/model-access/api-key`, `/model-access/oauth/{providerId}/start`, `/model-access/oauth/{providerId}/poll/{sessionId}`, `/model-access/oauth/{providerId}/submit`, `/model-access/oauth/sessions/{sessionId}`, `/model-access/openrouter` |
| Platform bindings               | `/bindings`, `/bindings/{id}`                                                                                                                                                                                                                                                                                                              |
| Runtime chat projections        | `/agent/chats`, `/agent/chats/{chatId}/messages`, `/agent/chats/{chatId}/agent-sessions/current`, `/agent/chats/{chatId}/agent-sessions/model`                                                                                                                                                |
| Runtime chat relay              | websocket `/chat`                                                                                                                                                                                                                                                                                                                          |

`POST /jobs/{slug}/run` is the single manual job-run interface. Runtime job
definitions own their payload schema and default input. Memory maintenance is
not a built-in Runtime job; Memory work belongs to agents through the managed
`memory` skill.

`/execution-settings` (GET/PUT) owns Tavern-stored agent execution settings.
The current supported setting is agent timezone. Runtime does not expose model
fallback chains, web page summarizer models, context compression, or subagent
defaults until the local agent engine supports those features.

`/agent-env` (GET/PUT) owns Tavern-stored environment variables for the managed
agent process. Values live in Tavern-managed secret storage; reads return saved
values for the local settings UI.

`/workspace/agents/{id}/files` and `/workspace/agents/{id}/files/{path}` expose
read-only browsing for the registered agent workspace. Paths are relative to
that workspace, traversal is rejected, hidden and generated dependency folders
are omitted from listings, and sensitive files such as `.env` and key material
are blocked. Tavern App uses these routes to preview linked workspace artifacts.

`/mcp/servers` owns Tavern-stored MCP server records. Secret env values live in
Tavern-managed secret storage and are materialized for the agent engine as
environment variables. Reads return server configuration without secret values.
`POST /mcp/servers/{name}/test` checks command resolution or URL reachability
without touching active turns.

`/plugins` owns Tavern Runtime Plugin records. Settings and write-only
secrets live in dedicated Runtime Plugin tables, health lives in Runtime
capabilities, and read-oriented domain actions such as
`/plugins/merchbase/action` and `/plugins/merchbase/sales/series`
use the Plugin client.

`/model-access/api-key` writes provider API keys through the Runtime model
access API. `/model-access/oauth/{providerId}/start` starts the provider OAuth
flow and returns either an auth URL or device-code instructions. Provider model
credentials are Runtime-owned.
Telemetry-only credentials, such as the OpenRouter management key used by
Stats, live with the feature that reads that telemetry.

## Contract Source

| Source                                              | Owns                                   |
| --------------------------------------------------- | -------------------------------------- |
| `packages/tavern-api/src/runtime/routes.ts`         | Admin route names                      |
| `packages/tavern-api/src/runtime/contracts.ts`      | Request and response schemas           |
| `packages/tavern-api/src/runtime/model-identity.ts` | Model provider and identity shapes     |
| `packages/tavern-api/src/runtime/skills.ts`         | Runtime skill file path helpers        |
| `apps/runtime/src/tavern/`                          | Runtime handlers                       |
| `@tavern/sdk`                                       | Typed client calls over the Tavern API |

## Rules

- **Runtime owns operations.** Health, capabilities, agent execution, cron, sessions,
  and skill state come from Tavern Runtime.
- **Runtime owns capabilities.** Runtime stores capability health and exposes
  the capability API. Jobs and app surfaces can use capability health to decide
  whether dependent functionality is available. The app may cache and render
  capability health, but it does not run checks or decide readiness.
- **Runtime update is staged.** `/update` installs the new Runtime package
  without restarting the service. `/update/status` reports the stage state.
  `/update/restart` is the explicit cutover request and restarts the Homebrew
  service only after Tavern is ready to finish the whole app/Runtime update.
- **Read routes are Runtime-backed.** Agent, chat, model, skill, and session
  reads return the latest Runtime state. Runtime refreshes
  execution-owned records from specific engine events. Session update events
  only record the session row they carry; they do not fetch the full transcript
  or graph. Session preview reads are bounded Runtime API calls for index views.
- **Models come from Runtime.** `/models` exposes the Runtime model catalog as
  read-only inventory. Runtime owns provider-specific catalog policy, including
  curated rows, live enrichment, and cache behavior. Agent model selection uses
  narrow agent mutations that update Runtime-owned per-agent execution
  settings, not an app-maintained list.
- **Chat stays canonical.** Runtime chat control routes do not replace the
  durable Chat API timeline.
- **Session facts stay execution-owned.** Session messages, graphs, prompts, and
  resync are runtime evidence for an agent execution.
- **The app is a client.** Tavern App may proxy, cache, and present this data,
  but the cross-boundary contract lives in `@tavern/api`.
