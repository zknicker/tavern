---
summary: Iterative mapping from GBrain concepts and setup steps into Tavern Cortex.
read_when:
  - changing Cortex architecture based on GBrain behavior
  - comparing Tavern Cortex to GBrain install, CLI, skills, tools, or jobs
  - deciding whether a GBrain step is copied, translated, or intentionally ignored
---

# Cortex GBrain Mapping

Tavern Cortex follows GBrain as the reference architecture, but it is not a
separate user-installed brain. Tavern Runtime owns Cortex storage, tools, jobs,
credentials, and agent guidance.

Use this doc as the running record for how GBrain concepts map into Tavern while
we work through them iteratively.

## Mapping Rules

- Copy GBrain behavior when it defines agent-facing memory semantics.
- Translate user-operated setup into Runtime-managed Tavern behavior.
- Keep user-facing names Tavern-native: Cortex, Tavern Vault, Runtime jobs, and
  Tavern settings.
- Do not add `init`, `doctor`, migration, or shell-profile chores for users.
- When a GBrain step depends on provider keys, route through Tavern Vault and the
  model catalog unless there is a concrete reason to use environment variables.

## Step 0: Agent Protocol

GBrain says non-Claude agents should read the repo `AGENTS.md` before operating.

Tavern mapping: **done**. Repo-local `AGENTS.md` is the coding contract, and
Tavern generates workspace `AGENTS.md` files for managed agents. Generated agent
guidance includes Cortex lookup, recall, capture, contradiction, and page-type
rules.

Intentional translation: Tavern does not copy GBrain's Claude-specific file
split. Tavern uses the repo instructions and generated managed-workspace
instructions.

## Step 1: CLI Surface

GBrain installs a global `gbrain` CLI.

Tavern mapping: **done**. Tavern exposes Cortex operations through the Runtime
CLI. See [Cortex CLI](cortex-cli.md) for the command reference.

```bash
tavern cortex capture "my fun memory"
tavern cortex search "theme across project notes"
tavern cortex recall "what should I know before replying?"
tavern cortex embed --stale
```

`tavern cortex embed --stale` runs the Runtime
`cortex-generate-embeddings` job and polls for completion. The CLI does not add
extra GBrain-divergent wait flags.

Intentional translation: users do not install Cortex separately. Tavern Runtime
ships and owns the Cortex CLI surface.

## Step 2: Model Access

GBrain asks the agent to configure API keys for embedding, fallback model, and
optional query expansion providers.

Tavern mapping: **done**. Tavern uses provider access rows in
`Settings -> Models`, stored in Tavern Vault:

| GBrain role                     | Tavern provider |
| ------------------------------- | --------------- |
| Embeddings                      | OpenAI API      |
| Query expansion                 | OpenRouter      |
| Chat Ingestion and Dream review | Codex OAuth     |
| Audio transcription             | OpenAI API      |
| OCR / vision source import      | OpenAI API      |

Intentional translation: Tavern does not ask users to edit shell profiles or
`~/.gbrain/config.json`. Runtime-owned secrets live in Tavern Vault. `OPENAI_API_KEY`
remains an operator fallback for Runtime OpenAI access, but the product path is
Tavern Vault. Import transcription and OCR use Cortex model settings backed by
model catalog capabilities rather than hardcoded model names.

Open question: GBrain now defaults to ZeroEntropy embedding and reranking.
Tavern currently uses OpenAI embeddings plus hybrid recall and does not expose a
ZeroEntropy/reranker provider.

## Step 3: Cortex Bootstrap

GBrain creates a PGLite brain with `gbrain init`, verifies it with
`gbrain doctor`, then asks the user to create or choose a markdown brain repo
and recommended schema.

Tavern mapping: **done**. Runtime starts Cortex automatically:

- creates or opens the Cortex PGLite database
- applies the Cortex schema
- creates the managed wiki directory
- seeds the active Cortex schema
- seeds default model and recall settings without overwriting operator changes

Intentional translation: users do not run `init`, `doctor`, or migrations.
Runtime-owned health, settings, jobs, and tests replace the manual GBrain
bootstrap workflow.

Tavern uses an editable active schema with page types and typed links rather
than creating a visible MECE directory tree such as `people/`, `companies/`, and
`concepts/`.

## Schema Evolution

GBrain has first-class schema-pack authoring. Agents can inspect schema packs,
detect untyped clusters, suggest new page types, review candidates, and apply
batched schema mutations through tools such as `schema_apply_mutations`.
GBrain's own skills still treat schema mutation as a gated operation:
`brain-taxonomist` files individual pages against the active pack, and
`schema-author` changes the pack only after assessment, lint, and user
confirmation. Agents should surface schema gaps; they should not silently
promote a new type just because one note is hard to classify.

Tavern mapping: **intentional divergence**. Cortex uses a source-controlled
default schema in `packages/tavern-api/src/runtime/cortex-defaults.ts`, then
allows the local runtime to add page and link types as agents encounter new
memory shapes. Tavern is a personal/local Cortex, so low-friction capture wins
over GBrain's heavier schema-author ceremony.

The Tavern pattern is:

1. Agents write the page or link type that best describes the memory.
2. If the type is not in the effective schema, Runtime stores it as a schema
   addition with reason, example, source refs, and audit.
3. Effective schema is the managed default schema plus runtime additions.
4. Settings -> Memories surfaces schema additions and usage counts for periodic
   cleanup.
5. Durable, broadly useful additions can later be promoted into
   `cortex-defaults.ts` with tests.

This trades GBrain's strict governance for a lighter local loop while keeping
the taxonomy auditable.

## Step 3.5: Recall Mode

GBrain requires the agent to stop and confirm the search mode instead of
silently accepting the default. The mode controls retrieval payload size,
query expansion, and downstream model cost.

Tavern mapping: **done**. Cortex exposes the same mode family through
`Settings -> Memories -> Models -> Default read budget` and through
`cortex_recall` mode input:

- `conservative`
- `balanced`
- `tokenmax`

Tavern default is `balanced`. This is the operator-confirmed default for Cortex:
moderate recall payload, no query expansion, and a lower surprise-cost profile
than GBrain's `tokenmax` default.

`tokenmax` is available for broad synthesis work. It raises the default recall
limit to 50 pages, runs OpenRouter-backed query expansion when an OpenRouter key
is available, and adds graph-neighbor hits.

Intentional translation: Tavern does not show GBrain's Claude-only cost matrix
verbatim because Tavern model access is provider-agnostic and may use Codex,
OpenAI API, or OpenRouter. The product setting names the user-facing tradeoff
instead of tying the choice to Claude model tiers.

## Step 4: Import and Index

GBrain imports an existing markdown corpus, optionally skips embeddings, then
embeds stale chunks and queries the imported content.

Tavern mapping: **intentionally skipped**. Tavern does not expose generic
markdown brain import through the Cortex CLI.

Intentional divergence: GBrain is a standalone brain that must ingest older
markdown brains and external corpora. Tavern Cortex is Runtime-owned and should
receive durable knowledge through capture, page edits, Chat Ingestion, Dream, and
future product ingestion flows. Runtime still uses an internal managed markdown
wiki and `cortex-sync` projection, but external directory import is not a user
surface.

## Step 4.5: Wire the Knowledge Graph

GBrain backfills typed links and structured timeline entries after importing an
existing markdown corpus. It explicitly skips this step for brand-new empty
brains because there is nothing to backfill.

Tavern mapping: **intentionally skipped**. Without generic markdown import,
there is no separate import backfill step for users.

```bash
tavern cortex graph-query <slug> --depth 2 --direction both
tavern cortex stats
```

Runtime refreshes deterministic links and chunks when pages are captured,
edited, projected, or maintained. Graph query runs a Runtime-side recursive
traversal over typed Cortex links, matching GBrain's engine-backed path
traversal instead of doing a CLI-side page walk.
`tavern cortex stats` reads Cortex status and reports the verification counts.

## CLI Parity: Source Ingest Foundation

GBrain has broad ingestion surfaces: inbox folders, webhooks, source records,
domain ingest skills, and raw ingest audit.

Tavern mapping: **done** for the shared Runtime ingest lane, **deferred** for
domain-specific connectors.

```bash
tavern cortex ingest article --file ./note.txt --locator https://example.com/note
```

Cortex ingest registers a source row, writes a source-backed Cortex page, keeps
the source ref on the page and timeline evidence, queues stale embedding repair,
and records Cortex audit. Future Tavern-owned sources such as webhooks, email,
calendar, voice notes, media transcripts, or article captures should normalize
bounded text into this route instead of inventing separate Cortex write paths.

This does not restore GBrain-style markdown import or extract backfill. Bulk
external import remains intentionally skipped until Tavern owns the source and
review workflow.

## CLI Parity: History, Revert, And Search Diagnostics

GBrain exposes page version history, page revert, paginated search, explained
ranking, and targeted search diagnosis.

Tavern mapping: **done** for the Cortex CLI/runtime path.

```bash
tavern cortex history <slug>
tavern cortex revert <slug> <version>
tavern cortex search "query" --offset 10 --explain
tavern cortex search diagnose "query" --target <slug>
```

Cortex records immutable page snapshots when managed markdown projection sees a
new page content hash. Revert applies the chosen snapshot through normal
`cortex_edit`, preserving a new version for the revert. Search explain reports
the ranking stages Tavern currently owns: lexical, vector, title, and alias
evidence. `search diagnose` uses the explained search path to show whether the
target appears in the top result window.

## Step 5: Load Skills

### Step 5 Skill: Brain Ops

GBrain's `brain-ops` skill defines brain-first lookup, read-enrich-write,
source authority, and non-blocking enrichment as the default agent behavior.

Tavern mapping: **done** in OpenClaw workspace bootstrap files and Cortex agent
resources. `AGENTS.md` owns Cortex operating policy; editable `SOUL.md` owns the
agent personality. Agents use Cortex when a
message depends on context not already present in the conversation, choose the
lightest Cortex tool that fits, ask or use live sources when Cortex does not
resolve the ambiguity, and use inline `cortex_capture` only when the user asks
to remember, save, or correct durable information.

Intentional translation: GBrain asks the agent to write on every inbound signal.
Tavern routes ambient writes through `cortex-chat-ingestion` and `cortex-dream`
so normal answers are not blocked by enrichment work.

### Step 5 Skill: Conventions

GBrain's convention docs define mandatory citations, brain-first lookup,
back-linking, notability gates, and source/brain routing.

Tavern mapping: **done** in `AGENTS.md`, Cortex agent resources, and
model-backed Cortex job prompts. Agents preserve provenance on Cortex writes,
mention related Cortex page names or slugs so links can be reconciled, use
`type: "note"` for explicit remember requests with no matching subject page,
avoid inline capture when future value is unclear, and preserve corrections or
contradictions as evidence instead of erasing older context.

Intentional translation: Tavern does not copy GBrain's exact inline citation or
manual backlink markdown format. Cortex stores structured source refs,
citations, relationships, claims, and timeline evidence through Runtime.

### Step 5 Skill: Query

GBrain's `query` skill defines brain-grounded answers through keyword search,
semantic query, page reads, graph traversal, timeline evidence, citation
propagation, gap flags, and conflict handling.

Tavern mapping: **done** as the first-party OpenClaw plugin skill
`cortex-query`. The Tavern Cortex plugin ships
`skills/cortex-query/SKILL.md`, so the skill is available whenever the managed
Cortex plugin is installed and enabled. The skill routes exact names to
`cortex_search`, broader or ambiguous questions to `cortex_recall`, complete
known subjects to `cortex_get_page`, and relationship questions to page links
plus `cortex_list_backlinks`.

Intentional translation: Tavern does not expose GBrain's `query`,
`traverse_graph`, or `get_timeline` tool names to agents. Cortex page reads
return compiled truth, links, timeline entries, claims, and source refs through
the Tavern Runtime API, and backlinks cover the current agent-facing graph
query lane.

### Step 5 Skill: Capture

GBrain's `capture` skill defines the simple human-facing save path for
"remember this", "save this thought", and "drop this in the brain". It wraps
the lower-level write primitive and keeps single-thought capture separate from
source, media, and article ingest.

Tavern mapping: **done** as the first-party OpenClaw plugin skill
`cortex-capture`. The Tavern Cortex plugin ships
`skills/cortex-capture/SKILL.md`, so agents have an explicit skill for durable
user-requested saves and corrections. The skill uses `cortex_capture` as the
front door, with `cortex_search` and `cortex_get_page` available when updating a
known subject.

Intentional translation: GBrain captures into `inbox/YYYY-MM-DD-*` through a
CLI receipt path. Tavern captures through the Runtime API, writes into Cortex
PGLite plus the managed markdown wiki, records source refs and audit, and lets
Runtime choose the stable page slug from the title. Ambient memory still belongs
to `cortex-chat-ingestion` and `cortex-dream`, not inline capture.

### Step 5 Skill: Ingest

GBrain's `ingest` skill is a router for content and media ingestion. It
delegates to idea, media, and meeting-specific skills, then preserves raw source
material, source citations, and entity links.

Tavern mapping: **done** for the source-backed ingestion stack as first-party
OpenClaw plugin skills:

- `cortex-ingest` routes generic source-backed content.
- `cortex-idea-ingest` handles links, articles, X posts, newsletters, and user
  ideas.
- `cortex-media-ingest` handles podcasts, videos, PDFs, books, screenshots,
  documents, transcripts, and repos when text or structured content is
  available.
- `cortex_import` imports GBrain media categories into Cortex: articles, X
  posts, audio, podcasts, videos, PDFs, books, documents, transcripts,
  screenshots, images, and repos.
- `cortex_ingest` writes normalized source text into Runtime-owned Cortex with
  source refs, audit, managed markdown projection, and stale embedding repair.

Intentional translation: Tavern does not add a meeting-ingest skill because it
is not part of the current workflow. Call notes can enter Cortex through
explicit capture or generic source import if needed. Tavern keeps article
fetch, configured OpenAI transcription, configured OpenAI vision OCR, PDF text
extraction, local repo summary, raw-source preservation, and source-backed
Cortex writes in Runtime. Archive mining and broad connector ingestion remain
separate future source paths. The deterministic test lane mocks provider
processors; the opt-in live lane in [Testing](testing.md#live-provider-smoke)
calls real OpenAI OCR and transcription against tiny generated artifacts.
A second opt-in lane downloads a NASA podcast clip, Wikimedia Commons
infographic image, and W3C sample PDF into a temporary directory, then verifies
Cortex writes distilled artifacts from real-world source files.

### Step 5 Skill: Enrich

GBrain's `enrich` skill creates and updates useful person and company pages
with tiered effort, source-backed current truth, texture, relationships, and
timeline evidence.

Tavern mapping: **done** as `cortex-enrich`. The Cortex plugin ships
`skills/cortex-enrich/SKILL.md`, so agents can enrich people, companies,
projects, products, brands, niches, production partners, platforms, tools, and
other durable local Cortex subjects. The skill uses Cortex search, recall, page
reads, backlinks, and `cortex_edit` to update pages through Runtime.

Intentional translation: Tavern does not hardcode GBrain's people/companies
directory model or require a strict no-stub filing gate. Cortex uses page types
plus runtime schema additions. Enrichment is still gated by durable value: do
not create pages for incidental mentions.

### Step 5 Skill: Source Enrich

GBrain's `article-enrichment` skill turns raw article dumps into structured
pages with summaries, useful quotes, why-it-matters context, insights, and
cross-references while preserving the raw source.

Tavern mapping: **done** as `cortex-source-enrich`. The Cortex plugin ships
`skills/cortex-source-enrich/SKILL.md` for articles, podcasts, videos, PDFs,
books, transcripts, screenshots, OCR dumps, and repo imports that need
synthesis after source import.

Intentional translation: Tavern generalizes GBrain's article-specific workflow
to every source-backed Cortex import. The raw artifact remains in Cortex files
and source refs; the agent can update the Cortex page through `cortex_edit` and
capture standalone takeaways only when they are useful beyond the source page.

### Step 5 Skill: Organize

GBrain's `eiirp` skill is the post-work organizer: inventory outputs, decide
where knowledge belongs, preserve sources, update pages, and make reusable work
durable instead of leaving it only in chat.

Tavern mapping: **done** as `cortex-organize`. The Cortex plugin ships
`skills/cortex-organize/SKILL.md`, which inventories significant work, creates a
small filing plan, writes or updates Cortex pages, preserves source refs, and
captures durable decisions, methods, follow-ups, and reusable context.

Intentional translation: Tavern does not include GBrain's skill-graph audit or
schema-cathedral commands inside this skill. Reusable coding-agent skills remain
source-controlled plugin work, and Cortex schema evolution remains Runtime
schema additions plus later source promotion.

### Step 5 Skill: Citation Fixer

GBrain's `citation-fixer` audits pages for missing or malformed citations,
repairs deterministic source links, and reports unresolved gaps without
inventing sources.

Tavern mapping: **done** as `cortex-citation-fixer`. The Cortex plugin ships
`skills/cortex-citation-fixer/SKILL.md` for citation audits, broken source
refs, weak provenance, and source-backed claim repair.

Intentional translation: Tavern does not require GBrain's inline
`[Source: ...]` markdown format. Cortex uses Runtime-owned source refs,
citations, links, claims, and timeline entries. The skill repairs traceability
through Cortex page edits and never guesses missing URLs, dates, post ids, or
source titles.

### Step 5 Skill: Frontmatter Guard

GBrain's `frontmatter-guard` validates and repairs markdown page metadata:
missing delimiters, YAML parse failures, slug mismatches, null bytes, nested
quotes, and empty frontmatter.

Tavern mapping: **done** as `cortex-frontmatter-guard`. The Cortex plugin ships
`skills/cortex-frontmatter-guard/SKILL.md` for page metadata, Cortex lint,
broken markdown shape, bad aliases, wrong page types, malformed timeline
entries, and schema-facing field repair.

Intentional translation: Tavern does not expose GBrain's `frontmatter` CLI or
file-path validation to agents. Runtime owns the page store and managed markdown
projection, so the skill validates the Cortex page contract through page reads
and `cortex_edit`.

### Step 5 Skill: Taxonomist

GBrain's `brain-taxonomist` is the filing gate before new brain pages. It reads
the active schema pack and recommends the right directory, type, slug, and
filing target instead of relying on a hardcoded directory table.

Tavern mapping: **done** as `cortex-taxonomist`. The Cortex plugin ships
`skills/cortex-taxonomist/SKILL.md` to decide whether knowledge belongs on an
existing page or a new page, which title/type/aliases should be used, and which
durable relationships should be recorded.

Intentional translation: Cortex has no GBrain directory-prefix filing model.
The active Cortex schema and Runtime page graph are canonical. When no type
fits, the taxonomist routes through `cortex-schema`, which can add local page
or link types without the heavier GBrain schema-pack approval flow.

## Step 7: Recurring Maintenance

GBrain installs scheduled upkeep for sync, embeddings, lint, maintenance, and
memory synthesis.

Tavern mapping: **done** through Runtime jobs:

- `cortex-sync` runs on Runtime startup and daily to project managed markdown
  into Cortex PGLite.
- `cortex-generate-embeddings` runs on startup, after Cortex writes, and every
  15 minutes when the embedding model capability is healthy.
- `cortex-lint` runs daily for unresolved links, invalid link/page types,
  duplicate-page candidates, zero-inbound orphans, missing cross-references,
  citation/provenance gaps, stale compiled truth, missing chunks, stale
  embeddings, and failed memory review audit.
- `cortex-repair-derived-state` runs daily for deterministic derived-state repair.
- `cortex-chat-ingestion` runs every 5 minutes when Codex OAuth is healthy.
- `cortex-dream` runs daily when Codex OAuth is healthy. It syncs Cortex,
  scans health, repairs derived state, selects recent Cortex pages/audit evidence
  and lint issues, asks the Dream model for consolidation proposals, applies
  page/claim/link/citation writes, repairs derived state, refreshes stale
  embeddings when possible, and stores a structured Dream report.

Runtime capability refresh reconciles job schedules after health changes, so a
job that was disabled at startup is scheduled once its required model access is
available. Saving or deleting OpenAI API access through Tavern Vault refreshes
embedding capability health and reconciles schedules immediately.

Intentional translation: Tavern does not ask users to install cron entries or
run GBrain doctor jobs manually. Jobs are visible and runnable through Runtime
job APIs and the app, but recurring Cortex upkeep is Runtime-owned.

Dream reports are data-first PGLite records, not markdown diaries. Runtime
stores one report row plus typed items for page updates, patterns,
relationships, citations, warnings, noops, phases, model/cost metadata, and
before/after health. The app can render that as a daily readable report without
parsing prose.

## Step 9: Verify

GBrain verifies schema, skills, auto-update, live sync, embeddings,
brain-first lookup, graph, and JSONB health.

Tavern mapping: **done for Runtime-owned checks**. Unit and integration tests
cover Cortex bootstrap, schema storage, skill routing, sync, search, recall,
graph traversal, embeddings, lint, repair, Dream, and CLI workflows. Manual
live verification lanes are:

```sh
bun run --filter @tavern/runtime smoke:cortex-verify
bun run --filter @tavern/website smoke:cortex-agent-lookup
```

The Runtime smoke writes a W3C-cited markdown knowledge page into a temporary
Cortex wiki, syncs it into PGLite, generates real OpenAI embeddings, edits the
markdown page, syncs again, and proves search plus recall return the updated
content. The agent lookup smoke seeds a unique Cortex page, asks the live agent
about that fact, and verifies the OpenClaw trajectory used a Cortex lookup tool
before the answer.

Intentional translation: Tavern Updates owns app/runtime update verification,
so GBrain's auto-update check is not a Cortex install step. GBrain's JSONB
repair check does not apply directly because Cortex runs on PGLite with typed
tables plus JSON metadata columns.

## Lint And Dream Troubleshooting

Use this when `cortex-lint`, `cortex-repair-derived-state`, or `cortex-dream` behaves
unexpectedly.

| Symptom                             | Check                                                             | Likely fix                                                       |
| ----------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Dream is disabled                   | Codex OAuth capability and Memory model settings                  | Connect Codex or choose a healthy Dream model.                   |
| Dream produced no report            | `runtime_job_runs`, `cortex_dream_reports`, `cortex_audit_events` | Confirm the job ran and Codex review returned proposals.         |
| Dream skipped work                  | Source hashes and recent `dream.review` audit events              | No new Cortex work needed consolidation.                         |
| Report has warnings or noops        | `cortex_dream_report_items`                                       | Review item reasons before changing pages.                       |
| Embeddings are stale                | `tavern cortex stats`, `cortex_chunks`, `cortex_encodings`        | Run `tavern cortex embed --stale` or fix OpenAI access.          |
| Orphan count looks wrong            | `cortex_links` inbound counts                                     | Orphans have zero inbound links; outbound links do not count.    |
| Missing cross-reference appears     | Page body mentions another Cortex page without a link             | Add the page link or relationship.                               |
| Health does not improve after Dream | Before/after report health and lint findings                      | Check unresolved provenance, invalid types, or stale embeddings. |

## Next Step

Continue reviewing the remaining GBrain skills only when they add a distinct
Tavern workflow instead of another way to write Cortex. Current intentional
skips include `meeting-ingestion`, standalone schema-author governance, remote
brain/auth/admin flows, GStack thinking skills, operational/day-planning
skills, and broad archive/webhook/minion surfaces.
