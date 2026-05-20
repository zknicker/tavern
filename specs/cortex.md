# Cortex

Cortex is Tavern's durable brain.

It is a database-backed, wiki-shaped knowledge system where agents compile raw
sources into maintained markdown pages. The app exposes those pages as the
Knowledgebase and exposes memory behavior through Memory inspection. OpenClaw
prompt-time context management remains separate.

The design follows the LLM Wiki pattern and the GBrain operating model where it
fits Tavern: immutable sources, compiled pages, schema-guided writing, explicit
links, source-backed timelines, searchable chunks, embeddings, audit, and jobs.

## Knowledgebase Model

Cortex has three layers:

* **Sources.** Immutable source material such as chats, messages, files,
  transcripts, URLs, user notes, tool outputs, and connector payloads. Cortex
  reads sources and preserves provenance; it does not rewrite them.
* **Wiki pages.** Agent-maintained markdown pages that synthesize sources into
  current knowledge. A page has one primary home, one stable id, one canonical
  slug, and zero or more aliases.
* **Schema.** Tavern-owned rules for page types, required frontmatter, link
  syntax, capture behavior, recall behavior, and jobs. The schema is executable
  product policy, not optional writing advice.

Each durable fact belongs to a primary page. Related pages are connected with
links instead of duplicating the same fact in multiple places.

## Markdown Format

Markdown is the human and agent-facing representation of Cortex pages. The
database is canonical for ids, source references, embeddings, audit, and job
state.

Every page renders with this structure:

```md
---
id: ctxp_...
slug: project/tavern-cortex
type: project
aliases: ["cortex", "tavern brain"]
tags: ["runtime", "memory"]
sources: [...]
updated_at: 2026-05-19T12:00:00.000Z
---

# Tavern Cortex

## Compiled Truth

Current best understanding. This section is rewritten when new source evidence
changes the answer.

## Open Threads

Unresolved questions, stale claims, or follow-up work.

## See Also

- [[memory]]
- [[openclaw]]

---

## Timeline

### 2026-05-19 | capture | chat:...

Append-only evidence entry with source references and the change it caused.
```

### Compiled Truth

Compiled truth is the current best understanding for the page. It is the part
agents read first when they need the current answer.

Compiled truth can be rewritten by capture, correction, merge, split, or
maintenance jobs. Rewrites must preserve provenance by appending timeline and
audit records.

### Timeline

The timeline is append-only page evidence. It explains what changed, when it
changed, who or what caused it, and which sources support it.

Timeline entries are not raw source copies. They are concise source-backed
event summaries linked to source records.

### Frontmatter

Frontmatter contains structured page metadata that should be queryable without
reading prose:

* stable page id
* canonical slug
* page type
* aliases
* tags
* source references
* confidence or source-quality metadata when relevant
* ownership and visibility metadata
* status such as `active`, `stale`, `archived`, or `deleted`
* timestamps and content hashes

### Claims

Claims are structured, source-backed facts extracted from page material and
sources. They make contradiction detection and compiled-truth repair queryable
instead of relying only on prose.

A claim stores the page id, subject, predicate, value, source reference,
confidence or source quality, observed timestamp, status, and supersession
links when a newer claim replaces an older one.

Claims support compiled truth, recall filtering, contradiction scans, and
source review. They do not replace the markdown page; they are the structured
record behind important assertions.

### Links

A Cortex link is a wiki-style markdown reference from one page to another page
slug.

Supported syntax:

* `[[target-slug]]`
* `[[target-slug|display label]]`
* `[[target-slug#heading]]`

The stored link record preserves:

* source page id
* target slug
* resolved target page id when one exists
* optional heading anchor
* optional display label
* link kind, such as `mentions`, `supports`, `contradicts`, `depends_on`, or
  `same_as`
* source location in the markdown, when available

Backlinks are derived by querying stored links by target. A missing target page
is a valid unresolved link, not corrupt data. Jobs can report unresolved links,
create placeholder pages, or ask the user or agent to resolve ambiguous targets.

Typed relationships are links with explicit `link kind` metadata. They remain
wiki links first; graph traversal and backlinks are derived from the parsed
link records.

### Chunks

Chunks are deterministic searchable text units derived from a page or source.
They are not embeddings.

A chunk stores:

* chunk id
* page id or source id
* source section such as `compiled_truth`, `timeline`, `body`, or `source`
* ordinal position
* text
* token count
* text hash
* created and updated timestamps

Chunk generation is deterministic for a given page version, chunking policy,
and source text. When the page text or chunking policy changes, Cortex replaces
the affected chunks and marks their encodings stale.

Chunks are used for lexical search, vector search input, recall snippets,
embedding coverage checks, and source-linked recall explanations.

### Encodings

Encodings are model-specific vector embeddings derived from chunk text. They
are not the source of truth.

An encoding stores:

* chunk id
* provider
* model
* dimensions
* vector
* input text hash
* embedding timestamp
* embedding job id or audit id

An encoding is current only when its model, dimensions, and input text hash
match the active chunk. If any of those change, Cortex marks the encoding stale
and excludes it from vector recall until the embedding job repairs it.

Recall can still use page reads and lexical search when vector encodings are
unavailable, but Cortex reports degraded recall rather than pretending vector
recall succeeded.

### Audit

Audit records describe Cortex operations. They are append-only operational
evidence, separate from page timelines.

Audit records cover:

* source import
* capture attempt and result
* page create, update, merge, split, archive, delete, and restore
* link parse, resolution, and repair
* claim extraction, supersession, and contradiction marking
* chunk generation
* embedding job start, success, failure, and stale detection
* recall query and returned page ids
* maintenance job start, success, failure, and records touched
* user correction and user-requested forgetting
* tool failures and provider errors

Each audit record stores a kind, status, actor, timestamps, affected record ids,
source references, model/provider metadata when relevant, error details when
relevant, and enough input/output summary to explain what happened without
storing secrets or duplicating raw source payloads.

## Runtime Ownership

Tavern Runtime owns Cortex. OpenClaw can call Cortex tools, but it does not own
the database, schema, jobs, embeddings, audit, or markdown mirrors.

Runtime responsibilities:

* **Store lifecycle.** Resolve the Cortex data paths under the Tavern Runtime
  root, create required directories, open the local database, acquire any needed
  write lock, apply schema migrations, and expose store health.
* **Schema policy.** Own page types, frontmatter fields, link kinds, chunking
  policy, embedding settings, capture policy, recall policy, and job policy.
* **Source ingestion.** Register source records, preserve immutable source
  references, normalize source metadata, and attach source references to pages,
  timelines, chunks, citations, and audit records.
* **Page writes.** Create, update, merge, split, archive, delete, restore, and
  read Cortex pages through validated write paths.
* **Markdown mirrors.** Render canonical database records into markdown files
  for browsing, export, Obsidian-like workflows, and agent reading. Import
  edits only through explicit validation and reconciliation.
* **Link graph.** Parse wiki links from markdown, resolve slugs to page ids,
  keep backlinks queryable, detect unresolved or ambiguous links, and update
  graph records after page writes.
* **Chunking and encodings.** Generate chunks from page/source text, compute
  text hashes, create embedding jobs, store encodings, mark stale encodings, and
  expose embedding coverage.
* **Search and recall.** Run lexical search, vector search, graph-aware recall,
  deduplication, ranking, and provenance assembly.
* **Audit and telemetry.** Record operation audit, job outcomes, provider
  failures, latency, queue depth, records touched, and capability health.
* **Agent tools.** Expose safe Cortex tools to OpenClaw agents and local tools
  with bounded inputs, provenance, and explicit errors.

OpenClaw owns native sessions, turns, transcripts, tools, model calls, files,
and Lossless Claw behavior during turns. Cortex failures must not be reported
as OpenClaw context-management failures.

## Storage Shape

Cortex storage is organized around durable records, not markdown files.

| Record | Purpose |
| --- | --- |
| `cortex_sources` | Immutable source references, source kind, source locator, hashes, and metadata |
| `cortex_pages` | Canonical page identity, slug, type, compiled truth, editable body, frontmatter, status, and timestamps |
| `cortex_page_aliases` | Alternate names, external ids, and lookup aliases for page identity resolution |
| `cortex_claims` | Structured source-backed claims extracted from pages, timelines, and sources |
| `cortex_timeline_entries` | Append-only page evidence entries with source references |
| `cortex_links` | Parsed wiki links, resolved page ids, link kinds, labels, anchors, and source locations |
| `cortex_files` | Local file attachments and mirrored source files |
| `cortex_citations` | Citation locators into sources, files, URLs, transcripts, messages, or documents |
| `cortex_chunks` | Deterministic searchable text units derived from pages or sources |
| `cortex_encodings` | Model-specific vector embeddings for chunks |
| `cortex_captures` | Bounded capture attempts, source ranges, status, outputs, retries, and errors |
| `cortex_jobs` | Runtime job definitions, leases, checkpoints, and schedules |
| `cortex_job_runs` | Job execution history, status, logs, records touched, and errors |
| `cortex_audit_events` | Append-only operational audit records |
| `cortex_telemetry_events` | Metrics for health, latency, queue depth, model/provider use, and failure rates |

Search indexes and markdown files are derived state. They can be rebuilt from
canonical records.

## Capture And Recall

Cortex capture creates or updates pages from deliberate notes, facts, decisions,
evidence, source documents, runtime events, user corrections, or agent
observations.

Capture always records provenance. A capture can update compiled truth, append
timeline evidence, extract structured claims, create links, attach citations,
generate chunks, queue encodings, and write audit.

Capture must be idempotent for the same source range and capture key. Replayed
captures return or update the existing capture record instead of duplicating
page evidence.

Cortex recall retrieves durable knowledge when active work needs more than
prompt-time context. Recall can combine:

* page title, slug, alias, and tag matching
* lexical search over chunks
* vector search over current encodings
* graph expansion through links and backlinks
* recency and source-quality signals
* page type and visibility filters

Recall returns bounded page hits with scored evidence, snippets, links to
source records, and an audit id. Agents receive grounded context, not raw
database rows.

## Agent Tools

Cortex exposes a focused agent tool surface:

* `cortex.recall`: search Cortex and return grounded, source-linked context.
* `cortex.capture`: save notes, facts, decisions, corrections, evidence, or
  observations with provenance.
* `cortex.getPage`: read a page by id, slug, alias, or link target.
* `cortex.listBacklinks`: list pages that link to a page or unresolved slug.
* `cortex.search`: run lexical and metadata search without LLM synthesis.
* `cortex.status`: inspect storage, pages, chunks, encodings, jobs, audit, and
  recent failures.
* `cortex.runJob`: request an allowed Cortex job such as link repair, embedding
  repair, or markdown mirror rebuild.

Tools are conservative. Agents use Cortex when durable knowledge can materially
improve the task, not before every response.

In OpenClaw, these tools are owned by the first-party `tavern-cortex` plugin.
The Tavern Messenger plugin remains responsible only for Tavern chat/channel
delivery.

## Tavern App Surfaces

* **Cortex.** Browse Cortex pages as markdown entities beside an Obsidian-style
  graph of wiki links, backlinks, source material, files, citations, search,
  status, and markdown mirrors.
* **Settings.** Configure embedding provider, embedding model, Cortex job
  policy, retention, visibility, and repair actions.
* **Agent runtime status.** Show flat readiness for OpenClaw memory separately
  from Cortex storage, capture, recall, encoding, and job health.

No app surface defines a second durable memory or knowledgebase store.

## Runtime Jobs

Cortex jobs keep the brain current, searchable, and trustworthy.

Cortex jobs are core maintenance and processing jobs, not a broad skill
library. A job belongs in Cortex when it maintains source ingestion, page
quality, recall quality, provenance, or user trust in the durable brain.

| Job | Purpose |
| --- | --- |
| Ingest | Register sources, enrich source metadata, update pages, append timeline evidence, extract claims and links, attach citations, and write audit |
| Recall index | Rebuild chunks, encodings, lexical indexes, vector indexes, backlinks, and other derived recall state |
| Lint | Detect broken links, duplicate pages, stale pages, conflicting claims, orphan pages, missing citations, source gaps, and stale encodings |
| Repair | Apply approved fixes from lint: merge pages, refresh compiled truth, resolve links, repair encodings, normalize timelines, and update audit |
| Export | Rebuild markdown mirrors, index files, source mirrors, and agent-readable exports from canonical records |
| Health | Report job status, capture failures, link health, claim health, embedding coverage, recall readiness, audit retention, and recent errors |

Jobs are Tavern Runtime jobs. OpenClaw cron can trigger visible summaries or
agent work that uses Cortex, but OpenClaw cron is not the scheduler of record
for Cortex maintenance.

Jobs are idempotent and checkpointed. Retrying a failed job must not duplicate
timeline entries, claims, links, chunks, encodings, or audit records. Jobs that
rewrite page-facing content must keep source evidence intact and write audit
for the records they touched.

Lint and repair can use targeted page sets, source ranges, indexes, and
previous job output instead of rereading the whole brain every run.

## Future Ideas

Cortex can grow richer ingestion through focused skills and workflows once the
core wiki loop is working. Examples include book digestion, article enrichment,
meeting ingestion, email triage, social monitoring, research briefs, source
verification, and connector-specific enrichment. These are optional source
pipelines that feed Cortex; they are not required core jobs or separate memory
systems.
