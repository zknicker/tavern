---
name: cortex-wiki
description: >
  Manage Cortex, Tavern's LLM-compiled knowledge wiki: ingest sources and
  collections, collect catalogs, track todos, register datasets, compile
  articles, query, lint, audit, research, run librarian maintenance, archive or
  restore topics, and generate outputs. Triggers: Cortex, cortex wiki, wiki,
  knowledge base, durable knowledge, inspect memory, query Cortex, query the
  wiki, ingest, compile, lint, audit, research, librarian, todos, backlog, watch
  list, dataset, data registry, collection import, collect, catalog, provenance,
  article quality, output drift, archive topic, restore wiki, implementation
  plan.
---

# Cortex Wiki Manager

You manage an LLM-compiled knowledge base. Source documents are ingested into `raw/`, then incrementally compiled into a wiki of interconnected markdown articles. The agent is both the compiler and the query engine.

## Operating Model

- Two entry modes: user chat turns, and unattended Tavern Runtime maintenance runs (compile, librarian, todo processing).
- Maintenance is fully automatic. Never schedule it, suggest it, or ask the user to run anything.
- Out-of-scope findings become `proposed` todo records — file, don't chase. Never park work on the user.
- Record uncertainty in article frontmatter (`confidence`, `verified: false`) rather than escalating.
- In unattended runs there is no user: confirmation and preview steps in these references do not apply — act directly within the run's stated scope.

## Hub Path

**HUB** is `TAVERN_WIKI_HUB_PATH`. Tavern Runtime owns this value and sets it
for every agent process; do not guess other locations. If it is unset or the
path is unreadable, stop and report the problem instead of falling back. If
`stat`/existence checks succeed but reading `wikis.json` or listing `topics/`
fails with `Operation not permitted`, the hub path is correct and macOS is
blocking this process; tell the user to grant Full Disk Access to the exact
app launching the agent and restart. See
[references/hub-resolution.md](references/hub-resolution.md).

## Wiki Location

**Topic sub-wikis are the default.** HUB is a hub — content lives in `HUB/topics/<name>/`. Each topic gets isolated indexes, sources, and articles. This keeps queries focused and prevents unrelated topics from polluting each other's search space.

For collection families that will grow across subjects, prefer kind-first topic
slugs such as `memes-bitcoin`, `memes-ethereum`, `tools-bitcoin`, or
`examples-seedqr`. Use subject-first slugs when the subject is the primary
research area and the collection is only one artifact within that topic.

Resolution order:

1. Named wiki (`--wiki <name>`) → look up in `HUB/wikis.json`; resolve registry paths as `<HUB>`, `~`, absolute, or relative to HUB, and fall back to `HUB/topics/<name>` if a registry path is stale
2. Topic in scope → `HUB/topics/<slug>/`
3. Otherwise → HUB (the hub)

When an operation targets the hub and the hub has no content, create or suggest a topic sub-wiki instead.

See [references/wiki-structure.md](references/wiki-structure.md) for the complete directory layout and all file format conventions.

## Core Principles

1. **Indexes are a derived cache.** The `.md` files and their YAML frontmatter are the source of truth. `_index.md` files are a cached view rebuilt on read when stale. Always read indexes first for navigation — but before trusting one, stale-check it (file count vs row count). See [references/indexing.md](references/indexing.md) for the Derived Index Protocol.

2. **Raw is immutable.** Once ingested into `raw/`, sources are never modified. They are a record of what was ingested and when. All synthesis happens in `wiki/`.

3. **Articles are synthesized, not copied.** A wiki article draws from multiple sources, contextualizes, and connects to other concepts. Think textbook, not clipboard.

4. **Dual-linking for Obsidian + agent navigation.** Cross-references use both `[[wikilink]]` (for Obsidian graph view) and standard markdown `[text](path)` (for agent navigation) on the same line: `[[slug|Name]] ([Name](../category/slug.md))`. Bidirectional when it makes sense.

5. **Frontmatter is structured data.** Every `.md` file has YAML frontmatter with title, summary, tags, dates. This makes the wiki searchable without full-text scans.

6. **Incremental over wholesale.** Compilation processes only new sources by default. Full recompilation is expensive and explicit (`--full`).

7. **Honest gaps.** When answering questions, if the wiki doesn't have the answer, say so. Never hallucinate. Suggest what to ingest to fill the gap.

8. **Multi-wiki awareness.** When querying, answer from the primary wiki first. Then peek at sibling wiki indexes (via `HUB/wikis.json`) for relevant overlap. Flag connections but never merge content across wikis.

9. **Chunk large writes.** Never create files longer than ~200 lines in a single Write call — the API stream idles during large generations, causing timeout errors. Write the skeleton (frontmatter + headers + first section) first, then use sequential Edit calls to append remaining sections. For plans, articles, and raw notes: write one section per tool call.

10. **Archive is quiet preservation.** Archived topic wikis live under
`HUB/topics/.archive/<slug>/` and are hidden from normal semantic workflows.
They remain structurally maintainable through explicit archive/lint operations.
Deep queries may surface archived index matches separately, but archived content
must not influence new synthesis unless the user explicitly includes it.

## Ambient Behavior

When this skill activates outside of an explicit wiki maintenance request:

1. Resolve the hub path (see Hub Path section above), then check if the wiki's `_index.md` exists
2. Read the master `_index.md` to assess if the wiki might cover the user's question
3. If relevant content exists → read the relevant articles and answer with citations
4. If no relevant content → answer normally, optionally suggest that the user can ask you to ingest it into the wiki.
5. When peeking at sibling wikis, only read their `_index.md` — do not read full articles unless the user asks. Skip archived sibling wikis by default; in deep mode, archived index matches may be reported separately.

If the user asks whether they can trust a wiki artifact, requests an audit,
mentions provenance or drift, or asks for content verification beyond a normal
query, use the Audit workflow instead of treating it as plain Q&A.

## Workflows

Choose the smallest workflow that matches the request, then load only the
reference material you need for that workflow:

- `ingest` and `ingest-collection` → `references/ingestion.md`
- `collect` → `references/todos.md` and `references/research-infrastructure.md`
- `todos` → `references/todos.md`
- `dataset` → `references/datasets.md`
- `archive` → `references/archive.md`
- `compile` → `references/compilation.md` and `references/indexing.md`
- `query` → read the relevant `_index.md` files first, then only the articles
  needed to answer
- `lint` → `references/linting.md`
- `audit` → `references/audit.md`
- `research`, `plan`, `output` → `references/research-infrastructure.md`
- `project` → `references/projects.md`
- `librarian` → `references/librarian.md`
- wiki structure, indexes, log format, file placement, init → `references/wiki-structure.md`
- hub lookup and path handling → `references/hub-resolution.md`

Collect requests create bounded catalogs of discoverable things: artifacts,
examples, resources, entities, tools, media, memes, or source candidates. See
`references/research-infrastructure.md` § Collect Catalogs for scale, media,
provenance, and todo-record rules.

Todos are first-class operational state, not a silo. Ingest, collection, and
collect workflows should suggest todo records when the user wants to track or
decide later.
Dataset manifests should link to todo records when next actions or
acceptance state matter. Compile and query may surface todo gaps, but
factual claims still need raw/wiki sources. Collect, research, audit,
librarian, refresh, plan, and output may propose durable follow-ups as
todo records, but larger pivots should start with a small sample preview.

Keep the first response short and action-oriented. Read deeper references only
after the user intent is clear or a write action is needed.

## Operational Rules

- Use absolute file paths in saved-output messages and markdown links for URLs.
- Append to `log.md` for every wiki write operation; never rewrite old log entries.
- Use article `confidence` fields when answering and flag weak sourcing when seen.
- If structure or placement looks wrong, use the `lint --fix` workflow from
  `references/linting.md` instead of inventing a one-off repair path.
