---
summary: Runtime admin and control routes for health, events, managed OpenClaw, sessions, cron, skills, models, bindings, and files.
read_when:
  - changing Tavern Runtime health, status, admin, or control routes
  - changing managed OpenClaw, cron, skills, sessions, models, or memory runtime APIs
  - changing packages/tavern-api/src/runtime contracts
---

# Admin API

The Admin API is part of the Tavern API.

Tavern App, managed OpenClaw, automations, local tools, and tests use it to
inspect runtime health, manage runtime-owned records, and control local runtime
capabilities. It is not a second product API.

## In The Box

* **Health and status.** Runtime readiness, identity, version, and capability
  state.
* **Runtime events.** Event replay and websocket notifications for operational
  state.
* **Managed OpenClaw.** Config, Gateway status, and local lifecycle control.
* **Operational records.** Agents, sessions, cron jobs, cron runs, models,
  skills, bindings, memory status, memory settings, and agent files.
* **Plugin relay.** The private Tavern Messenger websocket for OpenClaw channel
  delivery. Durable chat history still lives in the Chat API.

## Route Groups

| Group | Routes |
| --- | --- |
| Health and status | `/health`, `/status` |
| Runtime events | `/events`, websocket `/events` |
| Managed OpenClaw | `/openclaw-config`, `/openclaw-gateway/status` |
| Agents and files | `/agents`, `/agents/{id}`, `/agents/{id}/config`, `/agents/{id}/files`, `/agents/{id}/files/{path}` |
| Sessions and execution evidence | `/sessions`, `/sessions/{sessionKey}/messages`, `/sessions/{sessionKey}/graph`, `/sessions/{sessionKey}/prompt`, `/sessions/{sessionKey}/resync` |
| Cron | `/cron-jobs`, `/cron-jobs/{id}`, `/cron-jobs/{id}/run`, `/cron-jobs/{id}/runs`, `/cron-runs`, `/cron-runs/{id}` |
| Skills | `/skills`, `/skills/{id}`, `/skills/install`, `/skills/{id}/config` |
| Memory, models, and access | `/memory/settings`, `/memory/status`, `/models`, `/model-access`, `/model-access/claude`, `/model-access/codex`, `/model-access/openrouter` |
| Platform bindings | `/bindings`, `/bindings/{id}` |
| Runtime chat control | `/chats`, `/chats/{chatId}/messages`, `/chat-status`, websocket `/chat` |

## Contract Source

| Source | Owns |
| --- | --- |
| `packages/tavern-api/src/runtime/routes.ts` | Admin route names |
| `packages/tavern-api/src/runtime/contracts.ts` | Request and response schemas |
| `packages/tavern-api/src/runtime/model-identity.ts` | Model provider and identity shapes |
| `packages/tavern-api/src/runtime/skills.ts` | Skill package and install shapes |
| `apps/runtime/src/tavern/` | Runtime handlers |
| `@tavern/sdk` | Typed client calls over the Tavern API |

## Rules

* **Runtime owns operations.** Health, status, managed OpenClaw, cron, sessions,
  and skill state come from Tavern Runtime.
* **Chat stays canonical.** Runtime chat control routes do not replace the
  durable Chat API timeline.
* **Session facts stay execution-owned.** Session messages, graphs, prompts, and
  resync are runtime evidence for an agent execution.
* **The app is a client.** Tavern App may proxy, cache, and present this data,
  but the cross-boundary contract lives in `@tavern/api`.
