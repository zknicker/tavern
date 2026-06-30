---
summary: Legacy Vault feature note for the Memory rename and compatibility route.
read_when:
  - changing legacy /vault or /dashboard/vault routing or vault-named compatibility APIs
  - removing the remaining vault compatibility layer
---

# Legacy Vault Surface

Vault is no longer a product concept. The user-facing surface is Memory.

`/vault` and `/dashboard/vault` redirect to `/memory`. The file browser, editor,
search, backlinks, metadata panel, and settings copy should say Memory.

Internal API and tRPC procedures can still use `vault` names until the wire
contract is renamed. New product copy and agent-facing prompts should use
Memory.

See [Memory](memory.md) and [Memory API](../api/memory.md).
