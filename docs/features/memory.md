---
summary: Memory feature for inspectable and editable facts/preferences, agent-aware context, and the knowledgebase boundary.
read_when:
  - changing prompt-time memory readiness, Cortex memory inspection, or memory visibility
  - changing how users inspect capture, recall, compiled truth, or memory health
---

# Memory

Memory is Tavern's agent-continuity behavior, not a separate primary app page.

It does not define a second durable memory database. Tavern has two memory
systems under the hood:

* **OpenClaw runtime memory.** Lossless Claw provides prompt-time recall during
  active OpenClaw turns.
* **Cortex.** Tavern's GBrain-style durable brain stores compiled truth,
  timelines, pages, embeddings, links, observations, capture output, recall
  audit, and maintenance state.

Cortex is the primary app surface for durable memory because durable memory is
Cortex. Runtime status and settings show whether prompt-time OpenClaw memory is
healthy.

## In Cortex

* **Runtime memory status.** Users can see whether managed OpenClaw has Lossless
  Claw configured.
* **Capture inspection.** Users can see what chats, files, notes, or agent
  observations were captured into Cortex.
* **Compiled-truth changes.** Users can inspect recent updates to Cortex's
  current best understanding.
* **Timeline evidence.** Users can see the append-only evidence that caused
  Cortex pages to change.
* **Recall inspection.** Users can see what Cortex returned to agents and why.
* **Maintenance health.** Users can see stale embeddings, failed captures,
  orphan links, and recent maintenance runs.

## Contract

Memory visibility is derived from OpenClaw memory readiness and Cortex state.
It does not create a parallel `memory_records` store.

When a user corrects memory, Tavern edits or appends to the relevant Cortex
page, timeline entry, link, tag, or source metadata. When a user asks Tavern to
forget something, Tavern marks or rewrites the relevant Cortex material with
auditable provenance instead of hiding it from prompts through a separate
shadow list.

Memory used in prompts is inspectable through its source:

* OpenClaw runtime memory readiness and tool use
* Cortex recall results
* Cortex page compiled truth
* Cortex timeline evidence
* Cortex capture and maintenance audit records

## Boundary

The Cortex page is the browsable wiki and graph. Tavern does not maintain a
separate Memory page or a separate `memory_records` store.

See [Cortex](../../specs/cortex.md) for the durable brain model and
[Memories](../../specs/memories.md) for the memory visibility contract.
