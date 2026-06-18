---
summary: Vault API for reading and editing the user's Markdown wiki, status, settings, pages, folders, search results, and backlinks.
read_when:
  - changing Vault page, folder, search, status, settings, or backlink APIs
  - changing the boundary between Tavern Runtime and Vault files
---

# Vault API

The Vault API exposes Tavern Runtime's path-safe read/write surface over the
user's Markdown wiki.

## Contract

* The Vault is a filesystem directory, not a Tavern database.
* Page identity is the Markdown path relative to the Vault root.
* Page bodies are Markdown file contents after light frontmatter parsing.
* Page saves replace the Markdown body and preserve existing frontmatter.
* Backlinks are derived from `[[wikilinks]]` and Markdown links.
* Search is lightweight title, path, frontmatter, and body matching.
* `configSource` is `environment`, `settings`, or `default`.
* Content writes require Tavern mutation headers and stay inside the Vault root.
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

The tRPC app router exposes the same reads under `vault.status`,
`vault.settings`, `vault.list`, `vault.get`, `vault.backlinks`, and
`vault.search`. Content mutations use `vault.createPage`, `vault.savePage`,
`vault.createFolder`, `vault.deletePage`, `vault.deleteFolder`, and
`vault.movePath`. Settings writes use `vault.saveSettings`.

## Related Docs

* [Vault feature](../features/vault.md)
* [Vault spec](../../specs/vault.md)
