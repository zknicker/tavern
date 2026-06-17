# Vault

Vault is Tavern's durable wiki: a plain-Markdown directory the user owns and
agents maintain with file tools.

## Contract

The Vault path resolves in this order:

1. `TAVERN_VAULT_PATH`
2. Settings -> Vault
3. `~/wiki`

Runtime persists the Settings path in Runtime metadata. Environment override
wins when present.

Runtime owns:

* path resolution
* read/write access checks
* Markdown file listing
* page reads
* light frontmatter parsing
* `[[wikilink]]` and Markdown link extraction
* backlink derivation
* simple title, path, frontmatter, and body search
* Settings -> Vault path updates

Runtime does not own:

* source ingestion
* compilation
* health scoring
* librarian scans
* todo queues
* wiki maintenance jobs
* direct wiki content mutation beyond creating `INDEX.md` when saving a path

## Agent Contract

Runtime installs the managed `vault` skill into the managed engine home. The
generated agent instructions tell agents to use that skill when the user says
"Vault", "wiki", "knowledge base", or "durable knowledge".

The `vault` skill directs normal wiki editing to the Obsidian skill and bounded
research folders to the llm-wiki skill. Agents read `INDEX.md` before changing
structure, update it when navigation changes, search for related notes before
creating new ones, and add useful wikilinks or backlinks.

## App Surface

The Vault tab shows:

* Markdown page tree
* page body
* file metadata
* wikilinks and backlinks
* search
* resolved path and access status

Settings and Memory show Vault readiness and counts. They do not expose hidden
pipeline controls.
