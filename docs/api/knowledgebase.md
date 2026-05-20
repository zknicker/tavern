---
summary: Knowledgebase API for pages, files, citations, backlinks, agent-authored notes, attribution, and memory boundaries.
read_when:
  - changing Cortex page, file, citation, link, recall, or maintenance APIs
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
* Capture and recall fail visibly when required embeddings are unavailable or
  stale. Plain page reads can remain available.
* Audit records track page writes, captures, recalls, maintenance, embedding
  repair, and failures.

## Surface

The API covers:

* list and search Cortex pages
* get a page by id or slug
* create or update a page
* delete or archive a page
* attach files and citations
* link related pages
* list backlinks
* capture notes, facts, evidence, decisions, or observations into Cortex
* recall relevant Cortex pages by query
* trigger or inspect Cortex maintenance
* inspect audit records, telemetry, and timestamps

## Memory Boundary

Knowledgebase is the human browsing API for Cortex. Memory APIs inspect Cortex
capture, recall, provenance, and maintenance. Context-management surfaces
inspect Lossless Claw prompt-time continuity separately.

## Related Docs

* [Knowledgebase feature](../features/knowledgebase.md)
* [Cortex](../../specs/cortex.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
