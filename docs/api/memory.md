---
summary: Memory API for inspectable Cortex facts, user review, scoping, attribution, prompt usage, and deletion behavior.
read_when:
  - changing memory visibility or Cortex inspection APIs
  - changing the boundary between OpenClaw context management and Cortex memory
  - changing how agents or users inspect capture, recall, or prompt memory
---

# Memory API

The Memory API is the product contract for memory inspection.

It is implemented through Cortex APIs and runtime capability status, not through
a separate `memory` tRPC router or a separate memory settings object.

It does not own a separate durable memory-record database. Durable agent memory
lives in Cortex pages, timelines, links, embeddings, and audit records.
OpenClaw context management for active turns is not Tavern memory.

## Contract

* Memory status reports Cortex capture, recall, embedding, and maintenance
  readiness.
* Context-management status reports whether managed OpenClaw prompt-time
  continuity is available.
* Memory used in prompts is inspectable through Cortex recall results, Cortex
  page compiled truth, timeline evidence, and audit records.
* User corrections write back to Cortex pages, timelines, links, tags, or source
  metadata.
* Forgetting is auditable. Tavern updates or marks Cortex material rather than
  hiding it through a second shadow memory list.
* Memory inspection remains available from synced local Tavern data when Runtime
  is offline, using the latest known Cortex snapshots.

## Surface

Memory inspection reads:

* Cortex status for storage paths, page/source/link/chunk counts, encoding
  coverage, maintenance runs, and recent capture, recall, and repair activity
* Cortex pages for compiled truth, timeline evidence, links, claims, and source
  references
* Cortex recall results and audit ids for prompt-time memory usage
* managed OpenClaw context-management readiness, separate from Cortex memory

There is no standalone memory model-slot configuration. The old persistence,
working, knowledge, and dream model slots belonged to a retired memory design.
Current Cortex capture, recall, indexing, and maintenance settings belong under
Cortex contracts when they exist.

The current Cortex implementation exposes storage, tools, deterministic claim
splitting, markdown mirrors, hybrid lexical/vector recall with OpenAI
embeddings when configured, and job status. The GBrain review loop is still
missing: bounded source capture should call a configured model to extract
observations, infer relationships, update compiled truth, and write
source-backed timeline and audit records.

## Agent Boundary

Agents use memory through explicit tools:

* Cortex tools for durable capture, page reads, recall, and maintenance.
* Context-management tools and status for prompt-time continuity when the active
  turn needs it.

Agents do not write a separate Tavern memory table.

## Related Docs

* [Memory feature](../features/memory.md)
* [Context management](../features/context-management.md)
* [Cortex](../../specs/cortex.md)
* [Memories](../../specs/memories.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
