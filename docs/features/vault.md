---
summary: Vault feature for browsing and editing the user's Markdown wiki, page graph, search, backlinks, and configurable wiki path.
read_when:
  - changing Vault browsing, Markdown editing, backlinks, search, or Vault path settings
  - changing how agents or users inspect durable wiki knowledge from Tavern
---

# Vault

Vault is Tavern's browser and editor for the user's wiki. The wiki is plain
Markdown on the local filesystem, owned by the user and maintained by the user
and agents.

Vault is not a second database, vector index, ingestion pipeline, compile
pipeline, or hidden maintenance system. It is a browsable file-backed knowledge
surface.

## In The Box

* **Markdown pages.** Vault lists Markdown files under the configured root,
  ignoring dot directories such as `.obsidian/`.
* **File browsing.** Vault shows pages and folders in a compact directory tree.
* **Editing.** Vault can create pages, create folders, save page body changes,
  delete pages or folders, rename paths, and drag pages or folders into another
  folder.
* **Editor modes.** The MDXEditor-backed editor supports rich Markdown editing,
  a formatting toolbar, draft stats, and dirty/save state. Tavern also offers
  app-level split and preview modes for read-only wiki navigation.
* **Metadata.** File metadata, frontmatter properties, and backlinks live in a
  slideable, collapsed-by-default right metadata panel so the editor and preview
  keep the central width.
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

Runtime exposes a small read/write API for path-safe Markdown file operations.
Tavern App renders the Vault tab from that API. Agents maintain the same files
through the managed `vault` skill: normal wiki work routes to the Obsidian
skill, and bounded research folders route to the llm-wiki skill.

## Boundary

Vault browses wiki files. It does not ingest, compile, score, repair, or
schedule wiki maintenance. Those are agent workflows, not Runtime jobs.
