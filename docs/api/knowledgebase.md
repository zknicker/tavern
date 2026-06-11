---
summary: Cortex API for reading llm-wiki hub status, topics, Markdown pages, search results, and backlinks.
read_when:
  - changing Cortex topic, page, search, status, or backlink APIs
  - changing the boundary between Tavern Runtime and llm-wiki files
---

# Knowledgebase API

The Knowledgebase API exposes read-only Cortex access to the llm-wiki hub.

## Contract

* The hub is a filesystem directory, not a Tavern database.
* Topic ids are llm-wiki topic slugs.
* Page identity is `(topic, path)`.
* Page bodies are Markdown file contents after light frontmatter parsing.
* Backlinks are derived from `[[wikilinks]]`.
* Search is lightweight title, path, and body matching.
* `configSource` is `environment`, `config`, or `runtime`; `runtime` means
  Tavern is using the managed Runtime wiki hub.
* Writes, ingestion, compilation, audits, and maintenance are llm-wiki agent
  workflows launched through Tasks or Runtime crons.

## Surface

The Runtime API covers:

* `GET /cortex/status`
* `GET /cortex/health`
* `GET /cortex/topics`
* `GET /cortex/pages?topic=<slug>&includeArchived=true`
* `GET /cortex/topics/:topic/pages/:path`
* `GET /cortex/topics/:topic/pages/:path/backlinks`
* `POST /cortex/search`

`GET /cortex/health` rolls up derived health: hub status, escalations
(inventory records with `status: proposed` and `owner: user`), the latest
`.librarian/REPORT.md` per topic, and managed wiki cron run state. Listings and
search exclude dot directories; report files stay readable by direct path.

The tRPC app router exposes the same reads under `cortex.status`,
`cortex.health`, `cortex.topics`, `cortex.list`, `cortex.get`,
`cortex.backlinks`, and `cortex.search`.

## Related Docs

* [Cortex feature](../features/knowledgebase.md)
* [Cortex spec](../../specs/cortex.md)
