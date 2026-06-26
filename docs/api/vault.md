---
summary: Compatibility vault API for Memory status, settings, pages, folders, search results, and backlinks.
read_when:
  - changing vault-named routes, schemas, or tRPC procedures that serve Memory files
  - renaming compatibility wire contracts from vault to memory
---

# Compatibility Vault API

`vault` is the current wire name for the Memory file API. Product surfaces call
the concept Memory.

## Contract

* The root is a filesystem directory, not a Tavern database.
* Page identity is the Markdown path relative to the Memory root.
* Page bodies are Markdown file contents after light frontmatter parsing.
* Page saves replace the Markdown body and preserve existing frontmatter.
* Backlinks are derived from double-bracket links and Markdown links.
* Search is lightweight title, path, frontmatter, and body matching.
* `configSource` is `environment`, `settings`, or `default`.
* `status.indexExists` means `TAXONOMY.md` exists.
* `status.freshness` reports whether live file-change notifications are
  watching, idle, or degraded.
* Dot directories, absolute paths, and traversal segments are rejected.

## Surface

The Runtime API covers:

* `GET /vault/status`
* `GET /vault/settings`
* `PUT /vault/settings`
* `GET /vault/pages`
* `GET /vault/pages/:path`
* `POST /vault/pages`
* `PUT /vault/pages/:path`
* `DELETE /vault/pages/:path`
* `POST /vault/folders`
* `DELETE /vault/folders/:path`
* `POST /vault/move`
* `GET /vault/pages/:path/backlinks`
* `POST /vault/search`

The tRPC app router exposes the same reads and mutations under `vault.*`.
Clients should label these surfaces as Memory.

## Related Docs

* [Memory feature](../features/memory.md)
* [Memory API](memory.md)
* [Memory spec](../../specs/memories.md)
