---
summary: Memory API boundary for Cortex inspection and prompt-time assistant memory.
read_when:
  - changing assistant memory, memory visibility, or Cortex inspection APIs
  - changing the boundary between Hermes context management and Cortex wiki browsing
  - changing how agents or users inspect durable wiki knowledge
---

# Memory API

The Memory API is the product contract for inspecting durable knowledge and
understanding prompt-time assistant memory.

Durable knowledge lives in the Cortex wiki hub. Runtime exposes it through the
Cortex API as read-only wiki topics, pages, search results, and backlinks. There
is no separate Tavern-owned memory table, vector index, schema-addition store,
or capture pipeline for Cortex.

Assistant memory is separate. Runtime configures the managed agent with the
local Mnemosyne memory provider and reports its readiness through Runtime
capabilities. Assistant memory is available to the agent through `memory_*`
tools; it is not a skill package and is not listed by the Skills API.

## Contract

* Cortex status reports the resolved Cortex wiki hub path, topic counts, page
  counts, and filesystem readiness.
* Cortex topics and pages expose the Markdown files under the Cortex wiki hub.
* Cortex search is a lightweight lexical scan over wiki Markdown.
* Backlinks are derived from `[[wikilinks]]` in page bodies.
* Prompt-time assistant memory remains execution state, not Cortex wiki
  content.
* Wiki maintenance, imports, research, audits, and compiles are regular agent
  jobs managed through Tasks and runtime crons.

## Agent Boundary

Runtime installs the managed `cortex-wiki` skill. Agents use that skill for writes and
maintenance, use memory tools for assistant memory, and use the Cortex API when
they need to browse the current wiki state from Tavern.

Runtime does not own hidden Cortex repair jobs. It only exposes the wiki hub and
checks that the hub is reachable.

## Related Docs

* [Memory feature](../features/memory.md)
* [Knowledgebase API](knowledgebase.md)
* [Context management](../features/context-management.md)
* [Cortex](../../specs/cortex.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
