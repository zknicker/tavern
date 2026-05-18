---
read_when:
  - changing the local app backend, tRPC procedures, client cache, or app-owned settings
  - changing how Tavern App consumes Tavern Runtime or Tavern API records
---

# Tavern App

Tavern App is the Tauri product surface and first-party Tavern Runtime client.
Its React client and local Node/tRPC layer are one app boundary, not the
canonical chat server.

## Ownership

* **API procedures stay thin.** Validate input, call product logic, and return a
  narrow result.
* **Product logic owns product nouns.** Chat, agents, memory, automations,
  skills, stats, profiles, and settings live under their capability, not under
  integration folders.
* **Chat history is runtime-owned.** Tavern Runtime owns chats, messages,
  participants, sequence, events, reads, soft deletes, and the product timeline.
* **Runtime integration stays behind adapters.** OpenClaw Gateway payloads and
  plugin-specific details do not leak into product domains.
* **App storage is cache and settings.** App screens can cache runtime records
  and app-local settings, but runtime durable reads recover after the app has
  been closed.
* **Optimistic UI is presentation state.** It can bridge one-frame chat handoffs,
  but it must not become durable chat history.

## Data Shape

App storage includes client cache, presentation state, profiles, local settings,
and runtime evidence views. Canonical chat records belong in Tavern Runtime.

Keep table names in product language. Attach runtime ownership with columns such
as `runtime_id`, `source`, or `last_synced_at`; do not create integration-shaped
table families for first-party Tavern behavior.

## Boundaries

* Runtime ownership: [runtime.md](runtime.md)
* Tavern API contracts: [../api/README.md](../api/README.md)
* TypeScript SDK: [../sdk.md](../sdk.md)
* Testing rules: [../operations/testing.md](../operations/testing.md)
