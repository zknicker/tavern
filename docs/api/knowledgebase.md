---
summary: Knowledgebase API for pages, files, citations, backlinks, agent-authored notes, attribution, and memory boundaries.
read_when:
  - changing Cortex page, file, citation, link, recall, or repair APIs
  - changing how agents create durable Cortex working material
---

# Knowledgebase API

The Knowledgebase API exposes the browsable Cortex wiki.

Knowledgebase records are Cortex records: pages, files, citations, backlinks,
chunks, embeddings, timelines, audit records, and telemetry.

## Contract

* Pages, files, links, citations, chunks, and audit events have stable ids.
* Page slugs are stable lookup keys within a source, but page ids remain the
  canonical identity.
* Source material keeps citation and attachment metadata.
* Agent-authored notes are attributable to the agent, chat, message, session,
  turn, job, file, URL, or citation that produced them.
* Pages link to chats, messages, automations, files, citations, and other pages.
* Search and recall results return enough metadata for agents and users to cite
  the source.
* Page reads include a small memory-health summary: chunk coverage, current
  embeddings, stale or missing embeddings, active model, and last indexed time.
* Vector recall uses Cortex PGLite `vector` columns as rebuildable derived
  state. Plain page reads and lexical search can remain available when vector
  recall is degraded.
* Runtime requests embedding generation after Cortex writes. Runtime `/jobs`
  exposes the Generate Cortex Embeddings job on a 15-minute cadence. The job is
  stale-only by default and accepts `stale: true` explicitly so clients request
  incremental repair instead of full regeneration.
* Source ingest registers normalized source text with provenance, writes a
  Cortex source page, and indexes it through the same page/chunk/embed path.
* Audit records track page writes, captures, recalls, repair, embedding
  repair, source ingest, Dream review, and failures.
* Dream reports are structured records for daily consolidation runs, with phase
  summaries, before/after health, notable items, warnings, noops, and model/cost
  metadata.

## Surface

The API covers:

* list and search Cortex pages
* get a page by id or slug
* create or update a page
* delete or archive a page
* list page versions and revert a page to a prior version
* attach files and citations
* link related pages
* list backlinks
* capture notes, facts, evidence, decisions, or observations into Cortex
* ingest normalized source-backed text into Cortex
* recall relevant Cortex pages by query
* trigger or inspect Cortex repair
* inspect audit records, telemetry, and timestamps
* list Cortex Dream reports

## Memory Boundary

Knowledgebase is the human browsing API for Cortex. Memory APIs inspect Cortex
capture, recall, provenance, and repair. Context-management surfaces
inspect prompt-time continuity separately.

## Related Docs

* [Knowledgebase feature](../features/knowledgebase.md)
* [Cortex](../../specs/cortex.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
