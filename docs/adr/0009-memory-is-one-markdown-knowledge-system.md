---
summary: Decision to split per-agent Memory from the shared Wiki while keeping Markdown as the durable knowledge format.
read_when:
  - changing Memory, agent core memory files, episodic extraction, dreaming, Wiki, or Memory settings
  - changing user-facing Memory or Wiki language, routes, or app surfaces
  - changing model categories for background agent work
---

# Memory And Wiki Are Separate Markdown Knowledge Surfaces

Tavern uses **Memory** for per-agent core context and **Wiki** for the shared Markdown knowledge
graph. Each Agent workspace owns that agent's core memory files such as `MEMORY.md` and `USER.md`
plus hidden per-agent episodic evidence. Shared cross-agent knowledge lives in the user-inspectable
Wiki root. There is no shared `USER.md` or shared `MEMORY.md`. Product copy, docs, app surfaces,
routes, and agent instructions must keep this split clear: Memory is per-agent and prompt-loaded;
Wiki is shared, browsable, Git-backed Markdown.

Durable knowledge has three write surfaces. Agent core memory files may be edited by the owning
agent when the user explicitly asks it to remember or change its operating defaults, and by that
agent's dreaming worker when promoting stable evidence into core memory. Agents and their
dream workers only update their own `USER.md` and `MEMORY.md`. Episodic Memory
lives inside the owning Agent workspace and is written automatically by extraction workers
after completed turns; normal agents do not edit it. Wiki may be edited by
agents during explicit Wiki or shared knowledge work, and by dreaming when promoting stable evidence.
Extraction workers never write core memory files or Wiki pages. Explicit user requests to remember something are
not routed through extraction; the main agent should write the appropriate core memory file or
Wiki page directly according to the taxonomy.

User preferences are agent-local by default and should be written to the current agent's `USER.md`
or `MEMORY.md` unless the user explicitly asks for shared/global memory. Durable project, domain,
person, company, site, and concept knowledge belongs in Wiki.

The app's Wiki page exposes shared Wiki pages. Agent core memory files belong in
agent workspace or settings surfaces, and per-agent Episodic Memory belongs in agent-specific
history/debug surfaces rather than the Wiki browser.

Memory worker activity is hidden from normal chat timelines. Extraction and dreaming appear on the
global Memory settings page as a combined history across agents, each run attributed to its agent
and linked back to the source chat. The page shows per-run outcomes in product language (what was
saved, files updated, or why nothing changed) rather than raw worker transcripts; full transcripts,
model, and usage stay in the Memory job tables for debugging. The page also owns the global Memory
toggle and an explicit per-agent Dream now action. Memory is not a per-agent settings tab. The
Fast/Standard category selection lives on the Models settings page because model categories are
generic Runtime settings for background work, not Memory-specific configuration.

`TAXONOMY.md` lives in Wiki as the single routing guide for Wiki work
and dreaming. Agent workspaces do not have per-agent taxonomies; their `USER.md` and `MEMORY.md`
follow fixed core-memory-file rules from the agent system prompt.

Memory knowledge remains file-backed Markdown, but Runtime bookkeeping lives in SQLite. Agent
core memory files, per-agent episodic Markdown, shared Wiki pages, and the shared
`TAXONOMY.md` routing document live on disk. Extraction cursors, debounce state, Memory job history,
dream state, model/usage/error records, touched-file records, and future revert metadata live in
Runtime database tables. `TAXONOMY.md` is the exception to "knowledge pages": it is a managed routing
document, not user knowledge and not ad hoc worker state.

Episodic Memory is append-only worker-owned evidence. Extraction appends observations, dreaming
reads them, and normal agents do not edit past episodic entries. Corrections should be modeled as new
entries or future revert operations rather than casual edits to old observations.

Wiki pages use Markdown frontmatter plus `## Current` and `## History` sections. Dreaming
should append evidence-backed `History` entries and update `Current` only when stable understanding
changes. Wiki writes must preserve user-authored content where possible, check the file hash
between read and write, and record touched-file diffs in the Memory job tables.

Agent-specific dreaming is thresholded, not run after every extraction batch. A dream is eligible
when the agent has new episodic entries since the last dream and either 24 hours have passed, five
extraction batches have completed, or the user explicitly asks to organize or update Memory.

Memory background work uses model categories rather than hardcoded models. Extraction uses the Fast category,
dreaming uses the Standard category, explicit user-requested Wiki work uses the current
chat model, and future heavy repair or import flows may use the Deep category. Visual Memory
extraction is out of scope for v1.

Model categories are user-owned Runtime settings, not per-agent overrides in v1. Agents still keep
their existing chat default and session effective model selection, while Memory background work resolves
their models from the global Fast and Standard categories.

Memory background work is Runtime-owned. Extraction runs over a deterministic window of
settled user-facing chat messages (cursor to settled target sequence) and uses the Fast category
model to distill that window into episodic observations; the observations, not raw transcript
excerpts, are what persist. Dreaming uses Runtime model-category resolution and a restricted tool
set only — shared Wiki pages plus the owning agent's own core memory files — with no chat
tools, no normal skill set, no SOUL/personality prompt, and no user-facing response behavior.

Memory background work is cost-bounded without skipping content. Extraction paginates its backlog into
bounded chunks — one Fast model call per chunk, cursor advance per chunk — so every settled message
is processed exactly once, including first-run backfill of a pre-existing chat; message content goes
to the extraction model verbatim, and only a single message larger than an entire chunk budget is
truncated with an explicit marker. Failed extractions retry a small capped number of times and then
wait for new chat activity, resuming from the last completed chunk. A dream is queued only when the
agent has new completed extractions since its last dream; consecutive dream failures back off
exponentially. Episodic input to one dream is size-capped newest-first, and finished Memory job
records are pruned after thirty days.

V1 has one global Memory on/off setting for core memory and background capture. When Memory is off,
Runtime does not inject core memory files, run extraction, or run dreaming. Existing Memory files may
remain on disk but are inert until Memory is re-enabled. Wiki pages and Wiki tools remain available as
the separate shared knowledge surface. Per-agent and per-turn automatic Memory toggles are deferred.

Normal agents do not need separate confirmation to write Wiki or their own core memory files
when the user explicitly asks them to remember, save, or update durable context. Proactive background capture
still routes through extraction and dreaming rather than normal-agent Wiki writes.

User edits and deletes to Wiki are authoritative. The Wiki root is a local Git
repository so user-facing tools, Obsidian, Finder, and agent file writes share the same Markdown
surface with recoverable history. Runtime commits a baseline before destructive page/folder
mutations, commits Runtime writes after they land, and the watcher commits external Markdown changes
after its normal debounce. Dreaming checks recent Git delete history before creating a missing page
from stale evidence, while explicit user creates can restore a path. Dreaming respects current file
content through hash checks and skips or retries if a file changed since read. Automated Memory worker
writes are audited in the Memory job tables with before/after hashes and diffs.

Implementation should land in slices. Slice 1 establishes the Memory contract: remove old
user-facing Memory labels, add the global Memory setting, seed per-agent `USER.md` and `MEMORY.md`, inject
Layer 1 only when Memory is enabled, remove shared root core memory assumptions, keep the app Memory
page focused on Wiki, add model category settings/resolution, and test prompt injection
plus Memory-off behavior. Slice 2 adds extraction, debounce, job tables, cursors, and per-agent
episodic files. Slice 3 adds dreaming, Wiki writes, and the agent Memory settings/history UI.

Extraction is queued after completed user-facing Agent turns but runs on an idle debounce rather than
immediately after every turn. Continued chat activity resets the debounce, so one extraction worker
processes all unextracted messages since the last extraction cursor after the chat has been idle for
the configured window. Debounce and extraction cursors are scoped per Chat and Agent seat, so busy
work in one Chat does not delay extraction for another. Extraction writes the owning Agent's
per-agent Episodic Memory. The initial debounce target is five minutes.
For v1, extraction reads only user-facing chat messages and assistant final replies. It does not read
raw tool results, shell output, activity metadata, screenshots, model thinking, or internal worker
traces.
