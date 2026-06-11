---
summary: Cortex feature for browsing llm-wiki topic wikis, Markdown articles, raw sources, inventory, datasets, outputs, and archives.
read_when:
  - changing Cortex wiki browsing, topic listing, Markdown reads, backlinks, or llm-wiki hub resolution
  - changing how agents or users inspect llm-wiki files from Tavern
---

# Cortex

Cortex is Tavern's browser for the user's llm-wiki hub. For the end-to-end
flow — how material becomes compiled knowledge and stays healthy — see
[Cortex Lifecycle](cortex-lifecycle.md).

The durable knowledge is plain Markdown. Tavern does not maintain a second
Cortex database, vector index, schema registry, claim table, Dream job, or chat
ingestion engine. llm-wiki owns research, ingest, compile, query, audit,
librarian, lessons, output, inventory, datasets, and archive workflows.

## In The Box

* **Topic wikis.** Cortex lists active and archived topic wikis from the
  llm-wiki hub.
* **Markdown pages.** Cortex reads `_index.md`, `config.md`, `log.md`, and
  pages under `wiki/`, `raw/`, `inventory/`, `datasets/`, `output/`, and
  `inbox/`. The page tree stays pure knowledge: dot directories such as
  `.librarian/` and `.audit/` and archived outputs under `output/.archive/`
  never appear in listings or search. Report files remain readable by direct
  path for the health surface.
* **File browsing.** Cortex shows pages in their wiki directory tree and opens
  Markdown in a read-only document preview.
* **Backlinks.** Cortex derives inbound references from `[[wikilinks]]` and the
  markdown half of llm-wiki dual-links, across topics, and shows them on each
  page.
* **Link navigation.** Wikilinks and relative page links open the target page
  in the document pane.
* **Search.** Cortex performs lightweight filename, title, and body search over
  Markdown files.
* **Status.** Cortex reports the resolved hub path, config source, topic counts,
  page counts, and filesystem access.
* **Health.** A status card in the sidebar rolls up Cortex health: hub access,
  open escalations, the latest librarian scan per topic (structured data from
  `.librarian/scan-results.json`), and managed maintenance run state. Opening
  it shows the health page with escalation cards — each card is a one-line
  question with an input, and answering spawns an agent chat that applies the
  decision to the wiki — plus per-article staleness and quality scores with
  flags, and trend charts of average staleness, quality, and open escalations
  over time. Health is derived purely from facts; the wiki files stay the
  source of truth, and history is an append-only Runtime projection.

## Contract

Hub resolution follows llm-wiki:

1. `TAVERN_WIKI_HUB_PATH` or `TAVERN_CORTEX_WIKI_PATH`
2. `~/.config/llm-wiki/config.json`
3. Runtime-managed `wiki/` under `TAVERN_RUNTIME_ROOT`

Topic wikis live under `topics/<slug>/`. Archived topics live under
`topics/.archive/<slug>/`, appear as `.archive/<slug>` in Cortex APIs, and are
hidden unless a caller explicitly includes archived topics.

Runtime exposes a small read API. The App renders the Cortex tab from that API.
Scheduled wiki work belongs to Tasks and Runtime crons, where agents can run the
managed `wiki` skill. Tavern ships managed default crons for the regular
llm-wiki maintenance cadence (compile, lint, librarian); see
[Automations](automations.md#managed-automations).

Runtime packages llm-wiki for managed Hermes. Startup copies the bundled
workflow skill directory to `HERMES_HOME/skills/wiki` and passes the resolved
hub path to the Hermes process.

## Boundary

Cortex browses wiki files. It does not compile or maintain the wiki.

Use llm-wiki for research, ingestion, compilation, auditing, librarian scans,
lesson extraction, and generated outputs.
