---
summary: Memory API boundary for Vault inspection and prompt-time assistant memory.
read_when:
  - changing assistant memory, memory visibility, or Vault inspection APIs
  - changing the boundary between prompt-time context and Vault browsing
  - changing how agents or users inspect durable wiki knowledge
---

# Memory API

The Memory API is the product contract for inspecting durable knowledge and
understanding prompt-time assistant memory.

Durable knowledge lives in the Vault wiki. Runtime exposes it through the Vault
API as read-only Markdown pages, search results, and backlinks. There is no
separate Tavern-owned memory table, vector index, schema-addition store, or
capture pipeline for Vault.

Assistant memory is separate. Runtime leaves the engine's built-in
`MEMORY.md` and `USER.md` stores enabled. They are prompt-time memory files,
not Tavern database tables, not Vault pages, and not skill packages.

## Contract

* Vault status reports the resolved path, page count, `INDEX.md` presence, and
  filesystem readiness.
* Vault pages expose the Markdown files under the configured Vault root.
* Vault search is a lightweight lexical scan over wiki Markdown.
* Backlinks are derived from `[[wikilinks]]` in page bodies.
* Prompt-time assistant memory remains engine execution state, not Vault wiki
  content.
* Wiki maintenance, imports, and research are agent workflows. Runtime does not
  own hidden wiki maintenance jobs.

## Agent Boundary

Runtime installs the managed `vault` skill. Agents use that skill for Vault
work, use the native `memory` tool for compact prompt-time assistant memory,
and use the Vault API when they need to browse the current wiki state from
Tavern.

Runtime only exposes the wiki and checks that the configured root is reachable.

## Related Docs

* [Memory feature](../features/memory.md)
* [Vault API](vault.md)
* [Context management](../features/context-management.md)
* [Vault](../../specs/vault.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
