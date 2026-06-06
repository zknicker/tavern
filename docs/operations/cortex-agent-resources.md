---
summary: Cortex agent operating resources for search, recall, capture, and contradiction handling.
read_when:
  - changing Cortex agent instructions, recall behavior, capture rules, or maintenance workflows
  - changing generated AGENTS.md Cortex guidance
---

# Cortex Agent Resources

Cortex operating resources define how agents use durable Tavern knowledge.

## Cortex

Cortex is Tavern's durable knowledgebase and memory. Use it when prior project
context, user preferences, decisions, corrections, or source-backed notes could
change the answer. Current user instructions and current source material win.

## Resolver

Generated AGENTS.md routes agents to Cortex skills. Skill files own tool
selection.

Route Cortex work to the appropriate skill(s) based on what the agent is trying
to do.

### Knowledgebase Operations

| Trigger | Skill |
| --- | --- |
| "What do we know about", "tell me about", "search for", "who is", "background on", "notes on" | `cortex-query` |
| "Who knows who", "relationship between", "connections", "graph query" | `cortex-query` |
| Creating or enriching a durable entity/page with current context, such as a person, company, project, product, tool, etc. | `cortex-enrich` |
| "enrich this article", "enrich this source", "make this source useful", imported source needs utility | `cortex-source-enrich` |
| "store this research", "put this in Cortex", "make this re-doable", "DRY this up", "file all of this", "organize all of this work", "archive this research thread" | `cortex-organize` |
| "fix citations", "citation audit", "check citations", "broken citations", missing source refs, or weak provenance | `cortex-citation-fixer` |
| "validate frontmatter", "check frontmatter", "fix frontmatter", "frontmatter audit", "Cortex lint", or page metadata issues | `cortex-frontmatter-guard` |
| "where does this Cortex page go", "file this in Cortex", "taxonomy check", "refile Cortex page", or "which page/type should this use" | `cortex-taxonomist` |
| "add a page type", "add a type to my schema", "schema author", "schema mutate", "schema add", "my Cortex has untyped pages", "propose new types from my corpus", "backfill page types", "evolve my schema", "researcher type", "make X an expert type", "add a link type", or a Cortex write needs a clearer page/link type | `cortex-schema` |

### Content And Media Ingestion

| Trigger | Skill |
| --- | --- |
| "capture this", "save this thought", "remember this", "save to Cortex", "correct this" | `cortex-capture` |
| User shares a link, article, X post, newsletter, idea, etc. | `cortex-idea-ingest` |
| "watch this video", "process this YouTube link", "ingest this PDF", "save this podcast", "process this book", "summarize this book", "PDF book", "ingest it into Cortex", "what's in this screenshot", "check out this repo", etc. | `cortex-media-ingest` |
| Generic "ingest this" | `cortex-ingest` |

### Routing Rules

Prefer the most specific Cortex skill. Route URLs/media by content type. For
known entities, query first unless creating or updating a durable page. Ask when
ambiguity would change what gets written.

## Cortex Ops

Priority: current user statement > Cortex compiled truth > Cortex timeline >
external sources. If Cortex materially shaped the answer, cite the page/source.

Tavern automatically processes chat history into Cortex memory in the
background. Use `cortex-capture` for explicit saves, corrections, durable
preferences, source-backed observations, project facts, or reusable notes. Keep
captures small, inspectable, source-linked, and traceable. Do not capture
guesses, broad chat dumps, secrets, or sensitive material without clear user
reason.

Write only durable, reusable knowledge. Do not create pages for incidental
mentions, unsupported claims, transient task state, or low-value source
fragments.

## Conventions

Preserve provenance. Include source context when available: user message, chat,
message id, date, source page, or URL.

Mention related page names/slugs. State relationships plainly: "uses
OpenRouter", "depends on Tavern Runtime", "contradicts the old pricing
assumption".

Create pages only for likely-reusable info. If the user explicitly asks to
remember something and no subject page fits, use `cortex-capture` with
`type: "note"` and a clear title.

Preserve corrections and contradictions as evidence. Update current truth
without erasing old evidence.

## Chat Ingestion Guardrails

Capture durable preferences, decisions, corrections, source-backed project facts,
business rules, recurring workflows, and reusable context. Do not capture secrets,
transient execution chatter, guesses, or broad chat dumps.
