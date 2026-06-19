# Vault

Vault is Tavern's durable wiki: a plain-Markdown directory the user owns and
edits through Tavern or agents.

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
* folder listing
* page reads
* page and folder creation
* page body saves that preserve frontmatter
* page and folder deletion
* page and folder moves or renames
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
* automatic wiki rewrites beyond user or agent requests

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

* compact Markdown page and folder tree
* page body rich Markdown editor
* edit, split, and preview modes
* Markdown formatting toolbar
* read-only wiki preview
* file metadata
* wikilinks and backlinks
* search
* resolved path and access status
* word, character, line, and draft-link counts
* add, delete, rename, save, and drag-to-folder move controls

Settings and Memory show Vault readiness and counts. They do not expose hidden
pipeline controls.
