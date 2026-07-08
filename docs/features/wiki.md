---
summary: Wiki feature for shared Git-backed Markdown pages, wikilinks, backlinks, search, and agent Wiki tools.
read_when:
  - changing shared durable Markdown pages, Wiki UI, Wiki agent tools, wikilinks, backlinks, or Wiki history
  - changing the boundary between per-agent Memory and shared knowledge
---

# Wiki

Wiki is Tavern's shared durable knowledge graph. It is a folder of Markdown
pages, backed by local Git history, that users and agents can browse, search,
link, edit, move, and delete.

Wiki is not core Memory. `USER.md` and `MEMORY.md` are per-agent core memory
files loaded into one agent's prompt. Wiki pages are shared across agents and
hold durable project, person, company, site, concept, and routine knowledge.

## Contract

The Wiki root contains Markdown pages and `TAXONOMY.md`. `TAXONOMY.md` is the
routing contract for where shared knowledge belongs. Wiki pages use normal
Markdown, YAML frontmatter, and `[[wikilinks]]`; backlinks are derived from page
bodies.

Runtime initializes the Wiki root as a local Git repository. Runtime commits a
baseline before destructive page or folder mutations, commits Runtime writes
after they land, and commits external Markdown edits observed by the filesystem
watcher. Git history is local recovery state and the delete-history signal for
background dreaming. It is not a remote backup contract.

## Agent Tools

Normal agents use Wiki tools for shared knowledge:

* `wiki_list`
* `wiki_search`
* `wiki_read`
* `wiki_write`
* `wiki_backlinks`
* `wiki_move`
* `wiki_delete`

Agents use these tools for explicit user-requested Wiki work. They use their
own workspace file tools for per-agent `USER.md` and `MEMORY.md`.

## Obsidian Compatibility

Wiki is Obsidian-compatible at the file-format level: Markdown files, folders,
frontmatter, and `[[wikilinks]]`. Tavern treats `.obsidian/` as opaque user
configuration. Tavern does not depend on Obsidian, Obsidian plugins, Dataview,
Canvas, or Obsidian's app runtime for core Wiki behavior.

## Related Docs

* [Memory](memory.md)
* [Memory API](../api/memory.md)
* [Context management](context-management.md)
* [Memory and Wiki ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
