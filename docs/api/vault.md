---
summary: Vault API for reading the user's Markdown wiki, status, settings, pages, search results, and backlinks.
read_when:
  - changing Vault page, search, status, settings, or backlink APIs
  - changing the boundary between Tavern Runtime and Vault files
---

# Vault API

The Vault API exposes Tavern Runtime's read surface over the user's Markdown
wiki.

## Contract

* The Vault is a filesystem directory, not a Tavern database.
* Page identity is the Markdown path relative to the Vault root.
* Page bodies are Markdown file contents after light frontmatter parsing.
* Backlinks are derived from `[[wikilinks]]` and Markdown links.
* Search is lightweight title, path, frontmatter, and body matching.
* `configSource` is `environment`, `settings`, or `default`.
* Writes to wiki content happen through agents and file tools. Runtime only
  saves the configured path.

## Surface

The Runtime API covers:

* `GET /vault/status`
* `GET /vault/settings`
* `PUT /vault/settings`
* `GET /vault/pages`
* `GET /vault/pages/:path`
* `GET /vault/pages/:path/backlinks`
* `POST /vault/search`

The tRPC app router exposes the same reads under `vault.status`,
`vault.settings`, `vault.list`, `vault.get`, `vault.backlinks`, and
`vault.search`. Settings writes use `vault.saveSettings`.

## Related Docs

* [Vault feature](../features/vault.md)
* [Vault spec](../../specs/vault.md)
