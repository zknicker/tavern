---
summary: Memory API for inspectable Cortex facts, user review, scoping, attribution, prompt usage, and deletion behavior.
read_when:
  - changing memory visibility or Cortex inspection APIs
  - changing the boundary between OpenClaw context management and Cortex memory
  - changing how agents or users inspect capture, recall, or prompt memory
---

# Memory API

The Memory API exposes Cortex memory inspection.

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

The API covers:

* read memory settings for Cortex capture, recall, and maintenance
* update memory settings for Cortex capture, recall, and maintenance
* inspect Cortex capture status and recent capture output
* inspect Cortex recall usage and provenance
* inspect compiled-truth changes and appended timeline evidence
* inspect Cortex embedding and maintenance health

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
