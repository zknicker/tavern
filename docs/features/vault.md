---
summary: Vault feature for browsing the user's Markdown wiki, page graph, search, backlinks, and configurable wiki path.
read_when:
  - changing Vault browsing, Markdown reads, backlinks, search, or Vault path settings
  - changing how agents or users inspect durable wiki knowledge from Tavern
---

# Vault

Vault is Tavern's browser for the user's wiki. The wiki is plain Markdown on
the local filesystem, owned by the user and maintained by agents.

Vault is not a second database, vector index, ingestion pipeline, compile
pipeline, or hidden maintenance system. It is a browsable file-backed knowledge
surface.

## In The Box

* **Markdown pages.** Vault lists Markdown files under the configured root,
  ignoring dot directories such as `.obsidian/`.
* **File browsing.** Vault shows pages in their directory tree and opens
  Markdown in a read-only document preview.
* **Backlinks.** Vault derives inbound references from `[[wikilinks]]` and
  Markdown links.
* **Link navigation.** Wikilinks and relative Markdown links open the target
  page in the document pane when the target exists.
* **Search.** Vault performs lightweight filename, title, frontmatter, and body
  search over Markdown files.
* **Status.** Vault reports the resolved path, config source, page count,
  `INDEX.md` presence, and filesystem access.
* **Settings.** Settings -> Vault lets the user set the wiki path. If
  `TAVERN_VAULT_PATH` is set, the environment path wins.

## Contract

The Vault path resolves in this order:

1. `TAVERN_VAULT_PATH`
2. Settings -> Vault
3. `~/wiki`

Runtime creates the configured root and an `INDEX.md` file when the path is
saved in Settings. `INDEX.md` is the global directory for the wiki.

Runtime exposes a small read API and one settings write. Tavern App renders the
Vault tab from that API. Agents maintain the files through the managed `vault`
skill: normal wiki work routes to the Obsidian skill, and bounded research
folders route to the llm-wiki skill.

## Boundary

Vault browses wiki files. It does not ingest, compile, score, repair, or
schedule wiki maintenance. Those are agent workflows, not Runtime jobs.
