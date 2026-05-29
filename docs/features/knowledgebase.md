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
  and vector-backed retrieval. Tavern stores the vector index in LanceDB as
  rebuildable derived state.
* **Backlinks and graph navigation.** Related pages are discoverable through
  links, tags, types, and source relationships.
* **Files and citations.** Source material keeps attachment, citation, and
  provenance metadata.
* **Agent-authored notes and edits.** Agents can capture, edit, archive, merge,
  split, and link Cortex material with audit.
* **Health and maintenance.** Embedding coverage, failed captures, stale chunks,
  health recommendations, and maintenance audit are visible.

## Contract

Knowledgebase identity is Cortex identity. Page ids are canonical. Slugs are
source-scoped lookup keys. Markdown files are canonical page content; Runtime
SQLite is the projection for ids, embeddings, links, audit, and maintenance.

Knowledgebase writes are Cortex writes. Agent-authored notes are attributable to
the user, agent, runtime job, chat, message, session, turn, file, URL, or
citation that produced them.

Cortex pages, sources, links, claims, timelines, chunks, audit, and job state
project from markdown into Runtime SQLite. LanceDB owns only the derived vector
index for chunk retrieval. If the vector database is unavailable, plain page
reads and lexical search can remain healthy while Cortex reports degraded vector
recall.

## Boundary

Cortex is the app surface for browsing durable knowledge and inspecting the
source-linked material agents can recall.

See [Cortex](../../specs/cortex.md) for the durable brain model.
