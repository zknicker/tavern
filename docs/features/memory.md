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
observations, capture output, recall audit, and repair state.

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
  orphan links, and recent repair runs.
* **Schema additions.** Users can see agent-added memory types and usage counts.
* **Context-management readiness.** Users can see whether managed OpenClaw has
  prompt-time continuity available.

## Contract

Memory visibility is derived from Cortex state. It does not create a parallel
`memory_records` store.

Memory configuration does not expose retired persistence, working, knowledge,
or dream model slots. Current settings and health should name Cortex concepts
directly: storage, markdown pages, capture, recall, encodings, links, audit, and
repair.

The implemented Cortex path writes captures to canonical markdown, projects
them into SQLite, parses typed links, builds deterministic claims, indexes
OpenAI embeddings when configured, and reports recall and job health. Cortex
tokenmax recall uses Runtime OpenRouter model access for query expansion, then
merges expanded search and graph-neighbor hits. Cortex Chat Ingestion reviews per-chat
message backlog every few minutes through the standard Codex OAuth model path
when the `codexOAuth` capability is healthy. Cortex Dream later consolidates
existing Cortex pages, audit evidence, source refs, and lint findings through
the same model path. Both apply structured page writes, timeline evidence,
observations, relationships, citations, noops, and warnings, and record
source-hash checkpoints plus model-call metadata in Cortex audit. Dream also
stores structured daily reports with phases, before/after health, notable
updates, warnings, and noops. Without Codex auth, the Runtime job capability
gate disables Chat Ingestion and Dream. Cortex page edits support archive,
merge, split, contradiction-preserving claims, and health recommendations.

When an agent encounters a useful memory shape outside the active schema, Cortex
adds the page or link type to runtime schema additions, writes the memory with
that type, and records an audit event with the reason and example. The effective
active schema is the managed base schema plus runtime additions. Settings ->
Memories shows those additions and usage counts for periodic cleanup.

When a user corrects memory, Tavern edits or appends to the relevant Cortex
page, timeline entry, link, tag, or source metadata. When a user asks Tavern to
forget something, Tavern marks or rewrites the relevant Cortex material with
auditable provenance instead of hiding it from prompts through a separate
shadow list.

Memory used in prompts is inspectable through its source:

* Cortex recall results
* Cortex page compiled truth
* Cortex timeline evidence
* Cortex capture and repair audit records
* context-management readiness when prompt-time continuity affects memory use

## Boundary

The Cortex page is the browsable wiki and graph. Tavern does not maintain a
separate Memory page or a separate `memory_records` store. Context management
is documented separately because prompt assembly is not memory storage.

See [Cortex](../../specs/cortex.md) for the durable brain model and
[Memories](../../specs/memories.md) for the memory visibility contract. See
[Context management](context-management.md) for the managed OpenClaw boundary.
