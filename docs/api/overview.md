---
summary: Tavern API architecture for OpenAPI chat/realtime, typed admin contracts, Runtime handlers, SDK wrapper, and contract rules.
read_when:
  - changing tRPC routers, runtime HTTP routes, websocket behavior, or SDK methods
  - adding integrations, bots, webhooks, automations, or external clients
---

# API Overview

Tavern has one cross-boundary API.

The Tavern API is the client-facing contract. It is defined by
`packages/tavern-api`, served by Tavern Runtime, and wrapped by `@tavern/sdk`.

The TypeScript SDK is the client wrapper around the Tavern API. It stays stable
even when local implementation details move between tRPC, HTTP routes, SQLite,
runtime adapters, and app caches.

```text
Tavern App, bot, webhook, automation, managed Hermes, or local tool
  -> TypeScript SDK or app backend proxy
  -> Tavern API
  -> Tavern Runtime
```

Tavern App is a first-party API client. Its local Node/tRPC layer can proxy,
cache, and shape data for React, but it does not define a separate product API.

## Contract-First Shape

* **OpenAPI for chat and realtime.** `packages/tavern-api/openapi.yaml` owns
  public HTTP chat, message, response, activity, artifact, read, delivery,
  event, and error shapes.
* **Typed contracts for admin.** `packages/tavern-api/src/runtime/*`
  owns health, status, managed Hermes, agents, sessions, cron, skills, models,
  memory, files, and bindings.
* **Runtime handlers.** Tavern Runtime returns Tavern API-shaped payloads.
* **SDK wrapper.** `@tavern/sdk` wraps fetch and WebSocket calls with typed
  chat, realtime, and admin methods.
* **Docs and gates.** API docs explain behavior, and tests prove the contract
  from generated types through client behavior.

## Capability Groups

| Capability | Contract |
| --- | --- |
| Chat | [Chat API](chat.md) |
| Admin | [Admin API](admin.md) |
| Agents | [Agents API](agents.md) |
| Memory inspection | [Memory API](memory.md) |
| Vault wiki | [Vault API](vault.md) |
| Automations | [Automations API](automations.md) |
| Skills | [Skills API](skills.md) |
| Stats | [Stats API](stats.md) |
| Integrations | [Integrations API](integrations.md) |
| Realtime | [Realtime](realtime.md) |
| Auth | [Auth](auth.md) |

## Sources

| Surface | Source | Role |
| --- | --- | --- |
| OpenAPI contract | `packages/tavern-api/openapi.yaml` | Chat and realtime wire objects, operations, receipts, events, and errors |
| Generated API types | `packages/tavern-api/src/generated/openapi.d.ts` | TypeScript contract generated from OpenAPI |
| Admin routes | `packages/tavern-api/src/runtime/routes.ts` | Health, status, managed Hermes, and runtime control route names |
| Admin schemas | `packages/tavern-api/src/runtime/contracts.ts` | Runtime-owned request and response schemas |
| TypeScript SDK | `packages/tavern-sdk` | Typed client wrapper for Tavern App, bots, webhooks, automations, Hermes, and tests |
| Tavern API docs | `docs/api/` | Capability behavior and invariants |
| App routers | `apps/server/src/api/` | First-party app wrapper/proxy for Tavern API |
| Runtime adapters | `apps/runtime/src/` | Mapping between Tavern chat state and Hermes execution |

Implementation files can move. API contracts stay organized around Tavern
capabilities.

## Contract Rules

* **Durable objects first.** Create messages, responses, activity, artifacts,
  Vault pages, automations, and skill records before relying on realtime
  notifications.
* **Receipts reconcile.** Writes return stable ids, sequence values, cursors, or
  receipts that let callers reconcile optimistic UI and retries.
* **Idempotency is explicit.** Duplicate ids or nonces return existing records
  instead of creating duplicates.
* **Events notify.** Websocket events are freshness signals. Durable reads,
  cursors, history, and sync paths recover missed state.
* **Runtime identity rides as metadata.** `session`, `turn`, `run`, and
  `delivery` are runtime facts unless the runtime boundary is being documented.
* **App clients use Tavern nouns.** Product-facing code speaks in chats,
  messages, responses, activity, artifacts, agents, memory inspection, Vault
  pages, automations, skills, and stats.

## Hermes Alignment

Hermes is one agent runtime behind Tavern.

The Tavern Hermes Runtime adapter maps Hermes sessions, stream events, tool
updates, assistant progress, thinking summaries, and final delivery onto
Tavern API messages, responses, activity, and artifacts. It does not define a
separate Hermes-specific chat contract for the app.

Adapter details live in
[Tavern Hermes Runtime Adapter](../internals/tavern-hermes-runtime-adapter.md).

## Related Docs

* [TypeScript SDK](../sdk.md)
* [Architecture Overview](../internals/architecture-overview.md)
* [Data Model](../internals/data-model.md)
* [Realtime](realtime.md)
