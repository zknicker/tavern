---
summary: Memory API boundary for llm-wiki inspection and Hermes prompt-time context.
read_when:
  - changing memory visibility or Cortex inspection APIs
  - changing the boundary between Hermes context management and Cortex wiki browsing
  - changing how agents or users inspect durable wiki knowledge
---

# Memory API

The Memory API is the product contract for inspecting durable knowledge and
prompt-time context.

Durable knowledge lives in the llm-wiki hub. Runtime exposes it through the
Cortex API as read-only wiki topics, pages, search results, and backlinks. There
is no separate memory table, vector index, schema-addition store, or capture
pipeline in Tavern Runtime.

## Contract

* Cortex status reports the resolved llm-wiki hub path, topic counts, page
  counts, and filesystem readiness.
* Cortex topics and pages expose the Markdown files under the llm-wiki hub.
* Cortex search is a lightweight lexical scan over wiki Markdown.
* Backlinks are derived from `[[wikilinks]]` in page bodies.
* Hermes context management remains prompt-time execution state, not durable
  Tavern memory.
* Wiki maintenance, imports, research, audits, and compiles are regular agent
  jobs managed through Tasks and runtime crons.

## Agent Boundary

Managed Hermes installs llm-wiki skills. Agents use those skills for writes and
maintenance, and use the Cortex API when they need to browse the current wiki
state from Tavern.

Runtime does not own hidden Cortex repair jobs. It only exposes the wiki hub and
checks that the hub is reachable.

## Related Docs

* [Memory feature](../features/memory.md)
* [Knowledgebase API](knowledgebase.md)
* [Context management](../features/context-management.md)
* [Cortex](../../specs/cortex.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
