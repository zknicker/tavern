---
summary: Memory feature for inspectable Cortex facts, preferences, capture, recall, provenance, and the context-management boundary.
read_when:
  - changing Cortex memory inspection, recall, capture, or memory visibility
  - changing the boundary between OpenClaw context management and Cortex memory
  - changing how users inspect capture, recall, compiled truth, or memory health
---

# Memory

Memory is Tavern's durable Cortex behavior.

It does not define a second durable memory database. Durable memory is Cortex:
the wiki, graph, compiled truth, timelines, pages, embeddings, links,
observations, capture output, recall audit, and maintenance state.

OpenClaw context management can help an active turn maintain bounded prompt
continuity, but it is not Tavern memory. Managed Tavern OpenClaw does not use
Lossless Claw. Runtime status and settings may show whether context management
is healthy, but remembered facts live in Cortex.

## In Cortex

* **Capture inspection.** Users can see what chats, files, notes, or agent
  observations were captured into Cortex.
* **Compiled-truth changes.** Users can inspect recent updates to Cortex's
  current best understanding.
* **Timeline evidence.** Users can see the append-only evidence that caused
  Cortex pages to change.
* **Recall inspection.** Users can see what Cortex returned to agents and why.
* **Maintenance health.** Users can see stale embeddings, failed captures,
  orphan links, and recent maintenance runs.
* **Context-management readiness.** Users can see whether managed OpenClaw has
  prompt-time continuity available.

## Contract

Memory visibility is derived from Cortex state. It does not create a parallel
`memory_records` store.

When a user corrects memory, Tavern edits or appends to the relevant Cortex
page, timeline entry, link, tag, or source metadata. When a user asks Tavern to
forget something, Tavern marks or rewrites the relevant Cortex material with
auditable provenance instead of hiding it from prompts through a separate
shadow list.

Memory used in prompts is inspectable through its source:

* Cortex recall results
* Cortex page compiled truth
* Cortex timeline evidence
* Cortex capture and maintenance audit records
* context-management readiness when prompt-time continuity affects memory use

## Boundary

The Cortex page is the browsable wiki and graph. Tavern does not maintain a
separate Memory page or a separate `memory_records` store. Context management
is documented separately because prompt assembly is not memory storage.

See [Cortex](../../specs/cortex.md) for the durable brain model and
[Memories](../../specs/memories.md) for the memory visibility contract. See
[Context management](context-management.md) for the managed OpenClaw boundary.
