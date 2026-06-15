---
summary: Cortex API for reading Cortex wiki hub status, topics, Markdown pages, search results, and backlinks.
read_when:
  - changing Cortex topic, page, search, status, or backlink APIs
  - changing the boundary between Tavern Runtime and Cortex wiki files
---

# Knowledgebase API

The Knowledgebase API exposes read-only Cortex access to the Cortex wiki hub.

## Contract

* The hub is a filesystem directory, not a Tavern database.
* Topic ids are Cortex wiki topic slugs.
* Page identity is `(topic, path)`.
* Page bodies are Markdown file contents after light frontmatter parsing.
* Backlinks are derived from `[[wikilinks]]`.
* Search is lightweight title, path, and body matching.
* `configSource` is `environment` or `runtime`; `runtime` means Tavern is
  using the managed Runtime wiki hub.
* Writes, ingestion, compilation, audits, and maintenance are managed wiki agent
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

`GET /cortex/health` rolls up derived health: hub status (`state` is `healthy`
or `degraded`), todos (open records — `proposed` or `blocked` — projected with
status and priority), recent todo completions (parsed from each topic's
`log.md` `todo` entries — completed records are deleted, so the log is the
history), todo processing state (running record, last and next run),
maintenance run tiles for the compile, librarian, and todo jobs, the latest
librarian scan per topic parsed from `.librarian/scan-results.json`, and
health history. History is an append-only Runtime projection sampled hourly;
it is derived and rebuildable, never authoritative. Unparseable scan files
are skipped. Listings and search exclude dot directories.

The tRPC app router exposes the same reads under `cortex.status`,
`cortex.health`, `cortex.topics`, `cortex.list`, `cortex.get`,
`cortex.backlinks`, and `cortex.search`.

## Related Docs

* [Cortex feature](../features/knowledgebase.md)
* [Cortex spec](../../specs/cortex.md)
