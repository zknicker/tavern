---
summary: Memory API boundary for durable Markdown knowledge, Memory browsing, and compatibility vault routes.
read_when:
  - changing Memory visibility, Memory status, Memory browsing APIs, or durable knowledge inspection
  - changing the boundary between Memory, prompt context, and Workspace
---

# Memory API

The product concept is Memory. Runtime exposes Memory as path-safe Markdown
files under the configured Memory root.

The current wire contract still uses `vault` route and schema names. Treat
those names as compatibility identifiers, not product language.

## Contract

* Status reports the resolved Memory path, page count, `TAXONOMY.md` presence,
  filesystem readiness, config source, and live-update freshness.
* Pages expose Markdown files under the Memory root.
* Search is lightweight title, path, frontmatter, and body matching.
* Backlinks are derived from double-bracket links and Markdown links.
* Content writes stay inside the Memory root and reject dot directories,
  absolute paths, and traversal segments.
* Runtime does not own hidden Memory repair queues, vector indexes, or
  background write pipelines.

## Agent Boundary

Runtime installs the managed `memory` skill. Agents use it for durable Memory
work and use the Memory API when they need to browse current Memory files from
Tavern.

## Related Docs

* [Memory feature](../features/memory.md)
* [Compatibility vault API](vault.md)
* [Context management](../features/context-management.md)
* [Memory spec](../../specs/memories.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
