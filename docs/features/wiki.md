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

Users edit the same page from the full Wiki or from a Wiki document opened in
the chat artifact pane. Both editors save with the hash from the page read, so
an agent, user, or external file edit that wins first causes the later save to
fail for reload instead of overwriting it. Pane edits enter the same local Git
history as every other Wiki write.

Pasted and dropped PNG, JPEG, GIF, and WebP images are stored beside the page
under `_attachments/` and inserted as relative Markdown image links. The full
Wiki and artifact pane resolve those links through Tavern Runtime.

Agents card maintained documents in chat with a bare `document` fence after
writing the Wiki page. The card opens that shared Markdown page in the artifact
pane; the maintained page body is not duplicated into the chat reply.

Runtime initializes the Wiki root as a local Git repository. Runtime commits a
baseline before destructive page or folder mutations, commits Runtime writes
after they land, and commits external Markdown edits observed by the filesystem
watcher. Git history is local recovery state and the delete-history signal for
background dreaming. It is not a remote backup contract.

## Page History

Every page exposes read-only history over that Git repository: the commits
that touched the page, each openable as a before/after diff. The Wiki
inspector shows a History section, and a Wiki page opened in the chat
artifact pane has a History toggle. Selecting text in a history diff in the
artifact pane offers "Quote in chat", inserting the quoted lines plus a
`tavern://wiki/...` source link into the composer. History is a projection —
there is no restore or revert action in v1.

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
