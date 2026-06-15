# Research Infrastructure

Shared subsystems for research runs (including `--mode thesis`), plus the
collect-catalog contract.

## Research Agent Briefs

Every research agent receives the same context shape: objective, focus, search
strategy, current wiki state, constraints, return format, and quality guide.

- Constraints: 2-3 web searches with varied terms, fetch full content for
  promising results, skip paywalled/SEO-spam/thin/duplicate pages, target 3-5
  high-quality sources.
- Return format per source: title, URL, quality score (1-5), 3-5 key-finding
  bullets, one-sentence ingest rationale.
- Quality scale: 5 peer-reviewed/landmark/primary data, 4 authoritative
  docs/well-sourced report, 3 decent coverage with some original insight,
  2 thin/derivative, 1 SEO spam.
- Question mode: the objective is a sub-question; the deliverable is evidence
  that answers it.
- Thesis mode: agents evaluate each source for relevance (skip tangential),
  evidence strength (meta-analysis > RCT > cohort > case > opinion >
  anecdotal), direction (supports | opposes | nuances), and a 1-2 sentence key
  finding; return ranked by relevance × evidence strength.
- Exhaustive mode: 4-5 searches per agent, accept quality 2+, follow
  interesting citations from pages found.

## Credibility Scoring (Phase 2b)

Independent assessment of source credibility before ingestion — agents do not
self-rate their own source quality. Credibility scores carry forward into
article `confidence:` frontmatter during compilation.

### Scoring Rubric

| Signal | Points | How to Detect |
|--------|--------|---------------|
| Peer-reviewed | +2 | DOI present, journal/conference name, PubMed ID, arxiv with venue |
| Recent (<=3 years) | +1 | Publication date check |
| Older (>3 years) | 0 | — |
| Very old (>10 years) | -1 | Unless it's a foundational/landmark paper |
| Known author/institution | +1 | Recognized university, major lab, cited expert |
| Unknown author | 0 | — |
| Potential bias detected | -1 | Industry-sponsored without disclosure, activist org, predatory journal |
| Vendor primary source | -1 | First-party vendor docs or blog about own product (authoritative for facts, but inherent promotional framing) |
| Corroborated by other agents | +1 per agent (max +2) | Multiple agents found similar claims from independent sources |

**Non-stacking rule**: Bias signals do not stack. If a source triggers both "potential bias" and "vendor primary source," apply only the more specific one (-1 total, not -2).

### Credibility Tiers

| Tier | Score Range | Action | Confidence Tag |
|------|------------|--------|---------------|
| High | 4-6 | Ingest | confidence: high |
| Medium | 2-3 | Ingest | confidence: medium |
| Low | 0-1 | Ingest only if unique angle | confidence: low |
| Reject | <0 | Skip | — |

### Bias Detection Signals

- Industry whitepaper with no independent validation
- Press release disguised as news article
- Predatory journal (rapid acceptance, broad scope, aggressive solicitation)
- Affiliate/sponsored content without disclosure
- Single-perspective advocacy org
- First-party vendor documentation or engineering blog about own product

### Exhaustive Mode

Lower rejection threshold — accept Medium and above. Still score everything; scores carry forward into article confidence tags.

## Progress Scoring (0-100)

Quantifies research quality per round to enable principled termination and low-yield detection.

### Formula

| Component | Calculation | Max Points |
|-----------|-------------|-----------|
| Sources ingested | count x 3 | 30 |
| Articles created/updated | count x 5 | 30 |
| Cross-references added | count x 2 | max(20, existing_articles x 2) — scales with wiki maturity |
| Average credibility score | avg x 4 | 20 |

### Interpretation

- 0-40: Minimal yield — consider changing strategy
- 41-70: Moderate — research is productive, continue
- 71-90: Strong — good coverage being built
- 91-100: Comprehensive — near-complete coverage

### Termination Decision Tree

```
progress_score >= 80?
  |-- YES -> Any high-impact gaps remaining?
  |           |-- YES -> Continue (but note quality is high)
  |           +-- NO  -> Cross-ref density > 60%?
  |                      |-- YES -> RECOMMEND EARLY COMPLETION
  |                      +-- NO  -> One more round focusing on connections
  +-- NO  -> progress_score < 40?
             |-- YES -> LOW YIELD WARNING
             |          -> Try: different terms, --deep, narrower topic
             +-- NO  -> Continue normally
```

When progress_score < 40 for two consecutive rounds: switch to `--deep`, try a
different search angle, narrow the topic, or report early completion
("research appears exhausted for this topic").

### Trajectory-Based Triggers

- **Declining**: 3 consecutive rounds dropping 30+ cumulative points → warn; consider narrowing, `--deep`, or early completion.
- **Plateau**: 2 consecutive rounds within 5 points and no new high-impact gaps → recommend early completion.
- **Stalled**: any single round <20 → stop and reassess (topic too narrow, wrong terms, or knowledge base already comprehensive).

## Gap Scoring & Reflection

Between rounds, reflect holistically on accumulated knowledge and score gaps
for the next round. Reflection's primary value is discovering cross-topic
connections between rounds, not changing research direction.

### Gap Scoring Formula

Each gap is scored on three dimensions (1-5 each):

| Dimension | 5 (highest) | 3 (moderate) | 1 (lowest) |
|-----------|-------------|--------------|------------|
| **Impact** | Filling this gap fundamentally changes understanding | Adds useful context | Nice-to-know but not essential |
| **Feasibility** | Likely findable with web search | May exist but hard to find | Probably requires primary research |
| **Specificity** | Well-defined, searchable question | Somewhat vague | Too broad to target effectively |

**Composite score** = Impact x Feasibility x Specificity (range: 1-125). Pick the top 3 gaps for the next round.

### Reflection Protocol

In priority order:

1. **Draw connections** between this round's findings and ALL prior rounds — the highest-value activity
2. **Update cross-references** — add See Also links between articles that share concepts across rounds
3. **Re-evaluate earlier gaps** — some may now be filled or irrelevant
4. **Score remaining gaps** using the formula above
5. **Adjust research direction** — only if findings clearly indicate a shift (rare)
6. **Note reflection in session registry** — add `reflection_notes` to the round entry

## Session Registry

Persistent state for multi-round research and thesis sessions, enabling crash
recovery and round-to-round continuity. Session files are ephemeral: never
committed, never indexed, cheap to lose.

### Research Session Schema (.research-session.json)

```json
{
  "session_id": "2026-04-06-143022",
  "topic": "research topic",
  "min_time_budget": "2h",
  "current_round": 2,
  "rounds_completed": [
    { "round": 1, "sources_ingested": 5, "articles_compiled": 3,
      "gaps": ["gap1"], "progress_score": 65, "reflection_notes": "..." }
  ],
  "cumulative_sources": 5,
  "cumulative_articles": 3,
  "status": "in_progress"
}
```

The thesis variant (`.thesis-session.json`) replaces `topic` with `thesis` and
each round carries `evidence_for`, `evidence_against`, `verdict_direction`, and
`next_round_focus`.

### Durable Provenance Files

Session registry files are for live recovery only — overwritten in place and
deleted on normal completion. Long-running workflows (research, thesis, audit)
also maintain two durable artifacts in the wiki root:

- `.session-events.jsonl` — append-only event log
- `.session-checkpoint.json` — latest replayable summary

These persist after completion and are what the audit layer uses to classify
provenance as `replayable` instead of merely `partial`.

### Event Log Schema (.session-events.jsonl)

One JSON object per line. Append only; never rewrite prior entries.

```json
{"ts":"2026-04-29T12:38:00Z","command":"research","phase":"round","event":"research_round_completed","session_id":"2026-04-29-120000","round":1,"sources_ingested":5,"articles_compiled":3,"progress_score":65}
```

Recommended fields: `ts` (ISO 8601), `command`, `phase` (`start`, `round`,
`reflection`, `scan`, `finish`), `event` (stable name), `session_id`,
`topic`/`thesis`/`scope`, `round`, counters, `artifacts` (paths written),
`notes`.

### Checkpoint Schema (.session-checkpoint.json)

Compact summary of the most recent important run. Rewrite atomically after each milestone.

```json
{
  "updated_at": "2026-04-29T14:05:00Z",
  "command": "research",
  "session_id": "2026-04-29-120000",
  "status": "completed",
  "topic": "cerebral amyloid angiopathy",
  "current_round": 3,
  "summary": { "cumulative_sources": 14, "cumulative_articles": 9,
    "last_progress_score": 82, "top_open_gaps": ["gap4", "gap5"] },
  "artifacts": [{ "path": "output/2026-04-29-caa-summary.md", "sha256": "abc123..." }]
}
```

`status` is one of `in_progress`, `completed`, `interrupted`, `failed`.

### Lifecycle and Resume

- Session start: create the session file, append a start event, write the checkpoint.
- Each round: update the session file, append round events, refresh the checkpoint.
- Normal completion: append completion event, refresh checkpoint, delete the ephemeral session file. Durable files persist.
- Interruption: the session file persists with `status: "in_progress"`.
- Resume: detect a session file in the wiki root, read the last completed round, and continue from its gaps/reflection. In a chat turn, confirm continue vs fresh; in an unattended run, continue. If no active session exists, read `.session-checkpoint.json` and the tail of `.session-events.jsonl` for the latest durable context. Starting fresh deletes only the ephemeral session file, never durable provenance.
- One session per wiki at a time. Never include session files in index counts or structural health checks.

## Research Plan Schema

The `--plan` flag decomposes a research topic into 3-5 independent paths that
execute in parallel. The plan lives only in `.research-session.json` and is
deleted on completion.

Parallel ingest is safe (each path writes unique raw files with path-prefixed
slugs), but parallel compilation is not (multiple agents updating the same
`_index.md`, overlapping articles). The pipeline splits: search + ingest run in
parallel across paths, then a single sequential compilation pass runs after all
paths complete.

When `mode: "plan"` is set, the session gains a `paths` array; each path has
`name`, `focus`, `search_angles` (2-3 strategies), `status` (`pending`,
`in_progress`, `completed`, `failed`), `sources_ingested`, and `agent_mode`
(`standard`, `deep`, or `exhaustive`).

### Resume Protocol (plan mode)

On resume, check `paths[].status`:

- **All `completed`** → skip to compilation
- **Some `pending`** → re-launch only pending paths
- **Some `in_progress`** → treat as `pending` (agent died mid-execution; partial raw files are fine — deduplication handles overlap)
- **Some `failed`** → retry once in an unattended run; in a chat turn, ask retry or skip

### File Ownership

Each path prefixes its raw file slugs with the path index to prevent filename collisions between parallel agents:

```
raw/<type>/YYYY-MM-DD-p<N>-<source-slug>.md
```

Where `N` is the 1-indexed path number. Index updates are skipped during
parallel ingest; the Derived Index Protocol (`indexing.md`) rebuilds them on
the next read. Safe because indexes are derived caches, not source of truth.

### Interaction with Other Flags

| Flag | Behavior with `--plan` |
|------|----------------------|
| `--deep` | Each path-agent launches 8 sub-agents instead of 5 |
| `--exhaustive` | Each path-agent launches 10 sub-agents, lower quality threshold |
| `--sources <N>` | Target N sources per path (not total) |
| `--min-time` | Round 1 executes the full plan; subsequent rounds generate new plans targeting remaining gaps |
| `--mode thesis` | Plan decomposes the thesis into evidence paths (supporting, opposing, mechanistic, etc.) |
| `--project <slug>` | All paths tag outputs with the same project |
| `--new-topic` | Creates the topic wiki first, then generates and executes the plan |

## Collect Catalogs

Collect builds a bounded catalog of discoverable things: artifacts, examples,
resources, entities, tools, media, memes, or source candidates.

- Infer scale and media policy from the request. Record aliases plus
  `found_in_context` provenance, and deduplicate candidates.
- Write a `type: collection` output at `output/collect-<slug>-YYYY-MM-DD.md`.
- Create todo records only when the list is small and durable enough;
  otherwise create or suggest one corpus record.
- For media-bearing collections, download and hash bounded public binary media
  into `output/assets/collect-<slug>/` by default. Never put binaries in
  `raw/`. Use defensive download settings: timeouts, file-size caps,
  content-type checks, and IPv4 retry (`curl -4`) when media hosts hang on
  IPv6.
- Use kind-first topic slugs such as `memes-bitcoin`, `memes-ethereum`, or
  `tools-bitcoin` for collection families that can grow across subjects.
- Never present "all" as exhaustive beyond the stated strategy and limit.
