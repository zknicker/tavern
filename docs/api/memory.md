---
summary: Memory API for inspectable remembered facts, user review, scoping, attribution, prompt usage, and deletion behavior.
read_when:
  - changing memory visibility, runtime memory status, or Cortex inspection APIs
  - changing how agents or users inspect capture, recall, or prompt memory
---

# Memory API

The Memory API exposes memory readiness and inspection.

It does not own a separate durable memory-record database. Durable agent memory
lives in Cortex pages, timelines, links, embeddings, and audit records. Runtime
prompt memory lives in OpenClaw through Lossless Claw.

## Contract

* Memory status distinguishes OpenClaw prompt-time memory readiness from Cortex
  capture, recall, embedding, and maintenance readiness.
* Memory used in prompts is inspectable through OpenClaw memory status, Cortex
  recall results, Cortex page compiled truth, timeline evidence, and audit
  records.
* User corrections write back to Cortex pages, timelines, links, tags, or source
  metadata.
* Forgetting is auditable. Tavern updates or marks Cortex material rather than
  hiding it through a second shadow memory list.
* Memory inspection remains available from synced local Tavern data when Runtime
  is offline, using the latest known Cortex and capability snapshots.

## Surface

The API covers:

* read memory settings
* update memory settings
* inspect OpenClaw runtime memory readiness
* inspect Cortex capture status and recent capture output
* inspect Cortex recall usage and provenance
* inspect compiled-truth changes and appended timeline evidence
* inspect Cortex embedding and maintenance health

## Agent Boundary

Agents use memory through explicit tools:

* OpenClaw runtime memory tools for prompt-time recall.
* Cortex tools for durable capture, page reads, recall, and maintenance.

Agents do not write a separate Tavern memory table.

## Related Docs

* [Memory feature](../features/memory.md)
* [Cortex](../../specs/cortex.md)
* [Memories](../../specs/memories.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
