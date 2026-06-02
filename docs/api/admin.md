---
summary: Runtime admin and control routes for health, capabilities, events, managed OpenClaw, sessions, cron, skills, models, bindings, and files.
read_when:
  - changing Tavern Runtime health, capabilities, admin, or control routes
  - changing managed OpenClaw, cron, skills, sessions, models, or memory runtime APIs
  - changing packages/tavern-api/src/runtime contracts
---

# Admin API

The Admin API is part of the Tavern API.

Tavern App, managed OpenClaw, automations, local tools, and tests use it to
inspect runtime health, manage runtime-owned records, and control local runtime
capabilities. It is not a second product API.

## In The Box

* **Capabilities.** Runtime readiness, identity, version, compatibility, and
  feature health.
* **Runtime events.** Recent event lists and websocket notifications for
  operational state.
* **Managed OpenClaw.** Config and local lifecycle control.
* **Operational records.** Agents, sessions, jobs, cron jobs, cron runs, models,
  skills, bindings, memory status, memory settings, and agent files.
* **Plugin relay.** The private Tavern Messenger websocket for OpenClaw channel
  delivery. Durable chat history still lives in the Chat API.

## Route Groups

| Group | Routes |
| --- | --- |
| Health and capabilities | `/health`, `/capabilities`, `/capabilities/{id}`, `/capabilities/{id}/refresh`, `/capabilities/refresh` |
| Runtime update | `/update/status`, `/update`, `/update/restart` |
| Runtime events | `/events`, websocket `/events` |
| Managed OpenClaw | `/openclaw-config` |
| Agents and files | `/agents`, `/agents/{id}`, `/agents/{id}/config`, `/agents/{id}/files`, `/agents/{id}/files/{path}` |
| Sessions and execution evidence | `/openclaw/sessions`, `/openclaw/sessions/previews`, `/openclaw/sessions/{sessionKey}/messages`, `/openclaw/sessions/{sessionKey}/graph`, `/openclaw/sessions/{sessionKey}/prompt`, `/openclaw/sessions/{sessionKey}/resync` |
| Jobs | `/jobs`, `/jobs/{slug}`, `/jobs/{slug}/run` |
| Cron | `/cron-jobs`, `/cron-jobs/{id}`, `/cron-jobs/{id}/run`, `/cron-jobs/{id}/runs`, `/cron-runs`, `/cron-runs/{id}` |
| Skills | `/skills`, `/skills/{id}`, `/skills/{id}/config` |
| Cortex, models, and access | `/cortex/settings`, `/cortex/status`, `/models`, `/model-access`, `/model-access/openrouter` |
| Platform bindings | `/bindings`, `/bindings/{id}` |
| OpenClaw chat projections | `/openclaw/chats`, `/openclaw/chats/{chatId}/messages` |
| Runtime chat relay | websocket `/chat` |

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

* **Runtime owns operations.** Health, capabilities, managed OpenClaw, cron, sessions,
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
  execution-owned records from specific OpenClaw events. Session update events
  only record the session row they carry; they do not fetch the full transcript
  or graph. Session preview reads are bounded Runtime API calls for index views.
  Skill and model reads may start a background refresh when their stored snapshot
  is missing or stale, but client reads do not synchronously call OpenClaw.
* **Models are a catalog.** `/models` mirrors OpenClaw `models.list` as a
  read-only model catalog. Agent model selection belongs to the OpenClaw config
  snapshot/apply flow, not the model inventory response.
* **Chat stays canonical.** Runtime chat control routes do not replace the
  durable Chat API timeline.
* **Session facts stay execution-owned.** Session messages, graphs, prompts, and
  resync are runtime evidence for an agent execution.
* **The app is a client.** Tavern App may proxy, cache, and present this data,
  but the cross-boundary contract lives in `@tavern/api`.
