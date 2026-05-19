---
summary: Tavern API map for the @tavern/api contract, Runtime host, SDK wrapper, and capability docs.
read_when:
  - looking for Tavern API capability contracts
  - changing client-facing API docs
---

# Tavern API

The Tavern API is `@tavern/api`-defined, Runtime-hosted, and SDK-wrapped.

Tavern App, bots, webhooks, automations, managed OpenClaw, local tools, and
tests use this surface instead of reading app caches, runtime tables, or
OpenClaw state.

Tavern's shape is clear:

* **`@tavern/api` defines the contract.** OpenAPI owns chat and realtime wire
  shapes; typed runtime contracts own admin and control routes.
* **Runtime serves the contract.** Tavern Runtime owns durable chat state,
  event cursors, activity, and automation delivery.
* **The SDK wraps the contract.** `@tavern/sdk` gives TypeScript clients a small
  typed API over Tavern API types.
* **Docs explain behavior.** Markdown covers ownership, ordering, durability,
  recovery, and intentional omissions.

| Area | Doc |
| --- | --- |
| Overview | [API Overview](overview.md) |
| Auth | [Auth](auth.md) |
| Realtime | [Realtime](realtime.md) |
| Chat | [Chat API](chat.md) |
| Admin | [Admin API](admin.md) |
| Agents | [Agents API](agents.md) |
| Memory inspection | [Memory API](memory.md) |
| Cortex wiki | [Knowledgebase API](knowledgebase.md) |
| Automations | [Automations API](automations.md) |
| Skills | [Skills API](skills.md) |
| Stats | [Stats API](stats.md) |

The TypeScript client wrapper lives in [TypeScript SDK](../sdk.md).
