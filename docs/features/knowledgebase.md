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
  and embedding-backed retrieval.
* **Backlinks and graph navigation.** Related pages are discoverable through
  links, tags, types, and source relationships.
* **Files and citations.** Source material keeps attachment, citation, and
  provenance metadata.
* **Agent-authored notes.** Agents can capture decisions, evidence, facts, and
  observations as Cortex material.
* **Health and maintenance.** Embedding coverage, failed captures, stale chunks,
  and maintenance audit are visible.

## Contract

Knowledgebase identity is Cortex identity. Page ids are canonical. Slugs are
source-scoped lookup keys. Markdown files are mirrors for browsing and export;
the Cortex store remains canonical for ids, embeddings, links, audit, and
maintenance.

Knowledgebase writes are Cortex writes. Agent-authored notes are attributable to
the user, agent, runtime job, chat, message, session, turn, file, URL, or
citation that produced them.

Embedding-backed capture and recall are all-or-nothing for paths that require
embeddings. Tavern must not write newly captured searchable page state with
missing embeddings. Plain page reads can remain healthy while capture and recall
are unavailable.

## Boundary

Cortex is the app surface for browsing durable knowledge and inspecting the
source-linked material agents can recall.

See [Cortex](../../specs/cortex.md) for the durable brain model.
