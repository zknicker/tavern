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

* Memory status reports Cortex capture, recall, embedding, and derived-state repair
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
  coverage, repair runs, and recent capture, recall, and repair activity
* Cortex schema additions for page or link types introduced during agent writes
* Cortex pages for compiled truth, timeline evidence, links, claims, and source
  references
* Cortex recall results and audit ids for prompt-time memory usage
* managed OpenClaw context-management readiness, separate from Cortex memory

There is no standalone memory model-slot configuration. The old persistence,
working, knowledge, and dream model slots belonged to a retired memory design.
Current Cortex capture, recall, indexing, and repair settings belong under
Cortex contracts when they exist.

The current Cortex implementation exposes storage, tools, deterministic claim
splitting, canonical markdown-backed captures and page edits, archive/merge/split
lifecycle actions, hybrid lexical/vector recall with OpenAI embeddings when
configured, tokenmax recall expansion through Runtime OpenRouter model access
plus page metadata and graph neighbors, status recommendations from lint
findings, and job status. Cortex Chat Ingestion and Cortex Dream use Codex OAuth
credentials for source review when
`~/.codex/auth.json` or `CODEX_HOME` is available, with models selected through
Memory settings. Chat Ingestion reviews per-chat message backlog every few
minutes. Dream consolidates existing Cortex pages, recent audit evidence, source
refs, and lint findings daily. Both apply structured page writes, observations,
relationships, timeline entries, citations, noops, and warnings, with
source-hash, model-call metadata, and token usage when returned by the Codex
route. Without Codex auth, the Runtime job capability gate disables
`cortex-chat-ingestion` and `cortex-dream`.

Schema additions are runtime schema terms, not source-controlled defaults. When
capture, page edit, or Dream introduces a new page or link type, Runtime stores
that term in Cortex, includes it in the effective active schema, writes an audit
event, and exposes the term with usage counts for later cleanup.

## Agent Boundary

Agents use memory through explicit tools:

* Cortex tools for durable capture, page reads, recall, and repair.
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
