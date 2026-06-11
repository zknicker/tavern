# Cortex

Cortex is Tavern's llm-wiki browser.

The source of truth is the user's llm-wiki hub: plain Markdown topic wikis with
raw sources, compiled articles, inventory records, dataset manifests, outputs,
indexes, config, logs, and archives. Tavern reads those files and presents them
in the Cortex tab.

## Architecture

```mermaid
flowchart LR
  Hub["llm-wiki hub"]
  Topics["topics/<slug>"]
  Archive["topics/.archive/<slug>"]
  Runtime["Tavern Runtime read API"]
  App["Cortex tab"]
  Tasks["Tasks and Runtime crons"]
  Skill["wiki skill"]

  Hub --> Topics
  Hub --> Archive
  Topics --> Runtime
  Archive --> Runtime
  Runtime --> App
  Tasks --> Skill
  Skill --> Hub
```

## Hub Layout

Tavern follows llm-wiki's layout:

```text
~/wiki/
├── wikis.json
├── _index.md
├── log.md
└── topics/
    ├── <topic>/
    │   ├── inbox/
    │   ├── inventory/
    │   ├── datasets/
    │   ├── raw/
    │   ├── wiki/
    │   ├── output/
    │   ├── _index.md
    │   ├── config.md
    │   └── log.md
    └── .archive/
        └── <topic>/
```

Hub path resolution:

1. `TAVERN_WIKI_HUB_PATH` or `TAVERN_CORTEX_WIKI_PATH`
2. `~/.config/llm-wiki/config.json`
3. Runtime-managed `wiki/` under `TAVERN_RUNTIME_ROOT`

Managed Hermes startup prepares the wiki skill package before launch:

* copy the bundled `wiki` workflow skill directory into `HERMES_HOME/skills/wiki`
* create the managed hub skeleton when it does not exist
* pass `TAVERN_WIKI_HUB_PATH` to the Hermes process

## Runtime Contract

Runtime owns only:

* hub resolution
* read/write access checks
* topic listing
* Markdown file listing
* page reads
* light frontmatter parsing
* `[[wikilink]]` extraction
* backlink derivation
* simple title, path, and body search

Runtime does not own:

* PGLite or vector storage
* embeddings
* claims
* schema registries
* source import processors
* chat ingestion
* Dream consolidation
* Cortex repair jobs
* hidden wiki maintenance

## Workflows

Research, ingestion, compilation, audit, librarian, lessons, generated outputs,
inventory maintenance, dataset maintenance, and archive lifecycle run through
llm-wiki. Routine wiki maintenance is a pipeline drained by Runtime jobs — no
crons, no human gate:

* **Compile job.** A 15-minute filesystem check counts uncompiled raw sources
  per topic from `log.md` order; at 5+ pending sources (or one waiting ~6
  hours) it runs one agent turn that compiles them and finishes with a
  structural pass over changed wikis. Settle window and cooldown bound runs.
* **Librarian job.** Weekly: scores staleness and quality, writes
  `.librarian/scan-results.json`, repairs mechanical findings, recompiles from
  raw already on disk, and files outside-world work as inventory records.
* **Todo job.** A 15-minute check drains inventory records one agent turn at a
  time, spaced by a cooldown. A record the agent cannot finish is blocked with
  its reason and the affected claims marked low-confidence — work is never
  parked on the user; corrections happen in conversation. Records with
  `owner: user` are treated as user-authored and skipped.

Inventory records surface in the product as todos; see
[Cortex Lifecycle](../docs/features/cortex-lifecycle.md).

## App Surface

The Cortex tab shows:

* topic selector
* Markdown page list (pure knowledge — dot directories and archived outputs
  stay out of listings and search)
* page body
* file metadata
* wikilinks and backlinks
* active and archived topic coverage
* a health card and health page: derived hub health, pipeline run state
  (compile, librarian, todos), the latest librarian report per topic, the
  todo queue with processing state and recent completions, and trend charts

Settings and Memory show hub readiness and counts. They do not expose embedding
or schema controls.
