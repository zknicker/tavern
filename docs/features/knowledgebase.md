---
summary: Knowledgebase feature for wiki pages, backlinks, collections, files, citations, agent notes, and durable project context.
read_when:
  - changing Cortex pages, agent notes, source material, or document workflows
  - changing wiki files, citations, links, backlinks, or collections
---

# Cortex

The Cortex page is Tavern's browsable wiki.

It is not a separate store from Cortex. It is the Obsidian-like product surface
for Cortex pages: a left pane of markdown entities and a canvas knowledge graph
of wiki links, backlinks, files, citations, tags, search, and graph navigation.

## In the box

* **Wiki pages.** Durable Cortex pages with titles, slugs, frontmatter,
  compiled truth, timelines, body content, and `[[wiki links]]`.
* **Search and recall.** Users and agents can search Cortex through hybrid text
  and vector-backed retrieval. Tavern stores embeddings in the Cortex PGLite
  database using Postgres-compatible vector search.
* **Version history.** Page snapshots can be inspected and reverted without
  losing the revert event.
* **Source ingest.** Bounded source text can enter Cortex with provenance and
  normal search, recall, and embedding coverage.
* **Backlinks and graph navigation.** Related pages are discoverable through
  links, tags, types, and source relationships.
* **Files and citations.** Source material keeps attachment, citation, and
  provenance metadata.
* **Agent-authored notes and edits.** Agents can capture, edit, archive, merge,
  split, and link Cortex material with audit.
* **Health and repair.** Embedding coverage, failed captures, stale chunks,
  health recommendations, and repair audit are visible.

## Contract

Knowledgebase identity is Cortex identity. Page ids are canonical. Slugs are
globally unique lookup keys. Markdown files are the editable page surface; the
Cortex PGLite database stores ids, embeddings, links, audit, and repair state.

Knowledgebase writes are Cortex writes. Agent-authored notes and ingested source
pages are attributable to the user, agent, runtime job, chat, message, session,
turn, file, URL, connector payload, or citation that produced them.

Cortex pages, sources, links, claims, timelines, chunks, audit, and job state
project from markdown into the Cortex PGLite database. If embeddings are not
configured, plain page reads and lexical search can remain healthy while Cortex
reports degraded vector recall.

## Boundary

Cortex is the app surface for browsing durable knowledge and inspecting the
source-linked material agents can recall.

See [Cortex](../../specs/cortex.md) for the durable brain model.
