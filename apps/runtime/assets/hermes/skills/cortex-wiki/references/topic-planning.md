# Topic Planning

Topic planning decides wiki boundaries before ingestion or compilation. It keeps
Cortex from becoming one tiny wiki per source file while also preventing one
giant catch-all wiki.

## Units

- **Source**: immutable evidence under `raw/`. A note, journal entry, URL,
  document, message, row, or export item is usually a source.
- **Topic wiki**: a durable research or operating area under `HUB/topics/<slug>/`.
  It owns a scoped raw corpus, article graph, todos, outputs, freshness rhythm,
  and logs.
- **Article**: synthesized knowledge under `wiki/`. Articles hold concepts,
  entities, timelines, playbooks, references, decisions, comparisons, and
  overviews.
- **Index**: a derived navigation cache. Indexes are not the knowledge model.

## Boundary Tests

Create a topic wiki only when most of these are true:

- **Durable query surface**: the user will ask about this area over weeks or
  months.
- **Corpus gravity**: many sources can accumulate here without making answers
  noisy.
- **Synthesis payoff**: cross-source synthesis is more valuable than preserving
  each source as its own silo.
- **Article graph potential**: the area can produce several durable articles,
  not just one overview.
- **Independent lifecycle**: the area needs its own todos, outputs, datasets,
  archive state, or freshness expectations.
- **Clear exclusion rule**: it is possible to say what does not belong in this
  topic.

If splitting would hide relationships the user expects the wiki to know, merge.
If merging would make queries drag in unrelated evidence, split.

## Non-Signals

These facts are provenance, not topic boundaries by themselves:

- file path
- folder leaf
- source title
- source type
- date
- author
- bookmark category
- one tool, product, person, or project mention in a thin note

Preserve those facts in raw frontmatter, article sections, tags, timelines, or
reference pages instead of automatically turning them into topic slugs.

## Anti-Patterns

- One topic per source file.
- One topic per dated log, meeting note, message, or journal entry.
- One topic per link-list page or bookmark folder leaf.
- One topic per thin entity note before there is an independent corpus.
- A topic whose only compiled article is `wiki/topics/overview.md`.
- Mirroring source paths as topic slugs without a semantic planning pass.
- Duplicating the same raw source into both a leaf topic and a broad topic to
  work around bad boundaries.

## Large Source Imports

Large imports still get topic planning. The agent should inspect the corpus,
decide the durable topic split, then ingest directly into those topic wikis.

Use cheap structure before expensive reading:

- file paths and directory counts
- titles, headings, frontmatter, timestamps, authors, and source types
- representative samples from each cluster
- manifests, schemas, or upstream indexes when available

Then create or reuse the broad topic wikis that best fit the corpus. If no
existing topics fit, create new broad topics as part of the import. Do not add
an intermediate intake topic just because the source is large.

When one upstream corpus splits across multiple topic wikis:

- keep the upstream collection id stable in raw frontmatter
- write a manifest for the subset ingested into each topic
- preserve original paths, revisions, timestamps, hashes, and adapter details
- link sibling topic indexes when cross-topic context matters
- avoid duplicating child sources unless a source is primary evidence for both
  topics

Use a dataset manifest instead of Markdown raw files when the source is large,
mutable, external, structured, or better queried in its native format.

If the corpus cannot be inspected enough to choose topics, pause in interactive
work and show the user the blocker. In unattended maintenance, file a proposed
todo with the inventory and the missing information instead of creating a
throwaway topic.

## Nested Semantics

The topic registry is flat: active topic wikis live at `HUB/topics/<slug>/`.
Do not create nested topic paths such as `topics/domain/subdomain/category`.

Represent hierarchy inside a topic wiki:

```text
HUB/topics/<durable-area>/
├── raw/notes/<source-file>.md
└── wiki/
    ├── concepts/<recurring-idea>.md
    ├── topics/<major-theme>.md
    ├── references/<curated-list-or-taxonomy>.md
    └── references/<timeline-or-glossary>.md
```

If a category grows large, nested article folders are allowed inside
`wiki/concepts/`, `wiki/topics/`, or `wiki/references/`, but every created
directory must have an `_index.md`.

Display names may include slashes, but a slash in the source folder path usually
means an internal category, not a nested topic path.

## Bulk Import Protocol

Use this protocol for Obsidian vaults, doc folders, exported notes, message
archives, and other user-owned collections.

1. Inventory the source tree: list source paths, rough counts, source types,
   dates, and obvious clusters.
2. Draft candidate topic wikis. For each candidate, write a one-sentence scope,
   one-sentence exclusion rule, expected source groups, and expected article
   families.
3. Merge or split candidates using the Boundary Tests. Do not let source paths
   decide by default.
4. Map each source to one primary topic. If a source crosses topics, prefer a
   cross-topic link, article citation, or todo. Duplicate only when the source
   is genuinely primary evidence for both topics and record why in `log.md`.
5. Ingest sources into `raw/` with original path and source metadata preserved.
6. Compile enough after ingestion to make each topic navigable. For manageable
   imports, write the first useful article graph in the same run. For huge
   imports, write source maps or collection overviews and file proposed todos
   for deeper compilation.
7. Write the first useful article graph when the source set supports it:
   overview plus the concept, entity,
   timeline, playbook, glossary, reference, comparison, or decision pages the
   source set supports.
8. File proposed todos for work that needs external fetches, corroboration,
   deduplication, or later user judgment.

For interactive chat turns, show the topic plan before writing unless the user
explicitly asked to proceed unattended. In unattended maintenance runs, file a
consolidation todo instead of stopping for confirmation.

## Placement Patterns

Use these patterns as heuristics, not fixed slugs:

| Source cluster | Usual placement |
| --- | --- |
| Dated operational logs | Raw sources inside the operating domain; compile timelines, decision rules, recurring metrics, follow-ups, and strategy articles. |
| Link lists or bookmarks | Raw sources inside the relevant domain; compile curated reference pages and file todos for URLs that need fetching or annotation. |
| Thin entity, product, project, or person notes | Entity/reference articles inside a broader domain; promote to a topic only after it has independent corpus gravity or lifecycle. |
| Process docs, SOPs, playbooks, and sprint notes | Playbook, workflow, decision, timeline, and role articles inside the relevant operating domain. |
| Large, mutable, external, or structured data | Dataset manifests under `datasets/`; compile only summaries, schemas, query recipes, and conclusions into articles. |
| Chat/session-derived lessons | Distilled raw notes or conversation-backed articles only when the lesson is durable; keep operational session context out of topic evidence until promoted. |

## Compilation Expectations

After a good import, raw source count and topic count should not move in
lockstep. The expected shape is fewer broad topic wikis and a richer article
graph inside each one.

No fixed ratio is correct. A small coherent collection might become one topic.
A mixed vault might become several. The deciding question is whether each topic
has an independent scope and useful article graph.

If an existing hub already has source-shaped topics, do not deepen the
fragmentation during maintenance. File a consolidation todo naming the likely
target topic, the source-shaped topics to merge or archive, and the articles
that should exist after consolidation.
