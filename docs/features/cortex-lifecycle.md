---
summary: How Cortex knowledge flows end to end — ingest to raw sources, compile to articles, librarian scoring, the todo pipeline, and the health surface.
read_when:
  - understanding how knowledge enters, compiles, and stays healthy in Cortex
  - changing the wiki maintenance jobs, todo pipeline, or the health surface
---

# Cortex Lifecycle

Cortex is the agent's durable knowledge: plain Markdown topic wikis. This is
the loop — material in, compiled knowledge out, health maintained without
review or sign-off.

Principles:

* **Files are the source of truth.** Tavern's database holds only derived,
  rebuildable projections.
* **The wiki is a pipeline; jobs drain it.** Runtime jobs check for work every
  15 minutes with cheap filesystem reads and run one focused agent turn only
  when there is real work. No crons; time enters only as the librarian's
  weekly rhythm.
* **Maintenance is agent work.** Findings become wiki edits or queued todos —
  never reports to review, never questions parked on the user. Uncertainty is
  recorded in the data (confidence, `verified`), and you correct things in
  conversation.
* **Each run finishes its own job site.** Inline work is what is already on
  disk plus mechanical repair; anything needing the outside world or rewrites
  is filed as a todo.

## The Shape

```
hub
└── topics/<topic>/
    ├── raw/          immutable sources — what was ingested, verbatim
    ├── wiki/         compiled articles — synthesized, cross-linked, cited
    ├── todos/        the todo queue — follow-up records with status/priority
    ├── datasets/     indexed structured data
    ├── output/       generated deliverables
    ├── log.md        append-only activity log
    └── .librarian/   scan output (hidden from the page tree)
```

## From "Remember This" To Knowledge

```
you: "remember this" ──► agent ingests in the current turn
                              │
                              ▼
                      raw/ source file        ◄── full content, queryable
                       + log.md entry             immediately
                              │
                              │ compile job — 15-minute check, runs when
                              │   • 5+ sources are pending, or
                              │   • one has waited ~6 hours
                              ▼
                   wiki/ articles — synthesized,
                   cross-linked, cited back to raw/
```

The ingest-to-compile gap barely costs recall: raw files hold full fetched
content and are indexed immediately. Compiling adds what raw lacks — synthesis
across sources, confidence ratings, links into existing articles.

Net: research dumps compile within the hour; a stray source waits a few hours
so small ingests batch. A settle window lets in-flight batches finish, a
one-hour cooldown stops runs stacking, and each compile turn ends with a
structural pass over the wikis it changed. Agent-driven research compiles
inline in the same run.

## Staying Healthy

```
weekly: librarian job                     every 15 min: todo job
│ scores every article                    │ queue empty? → free, no run
│ (staleness + quality)                   │ otherwise: one agent turn works
│ repairs what is mechanical              │ the top todo and stops
│ recompiles from raw already on disk     │ (~45 min between turns)
│ files outside-world work ──────────────►│
│   as todos                              ▼
                                  done: record deleted, log.md entry
                                  is the history — or blocked: record
                                  kept with the reason + affected
                                  claims marked low-confidence
```

The do-vs-file litmus, for every run: **work with what's on disk inline;
anything needing the outside world (fetches, research) or prose rewrites
becomes a todo.** Detection is cheap and comprehensive; treatment is expensive
and per-item — the queue is the buffer between them, and it gives each finding
a durable record with attempt history instead of a slot in some giant run.

There is no human gate. A todo the agent can't finish gets blocked with its
reason, and the affected claims get marked so answers hedge; if it matters,
it surfaces in conversation and you settle it there.

Scores stay current per run: compile and todo turns re-score the articles they
changed in the scan results, so the health page reflects work as it lands. The
weekly librarian remains the full re-baseline.

## Watching It Work

The sidebar health card rolls everything into one state — healthy or hub
unreachable — with the open todo count. The health page behind it: pipeline
run tiles (compile, librarian, todos — last run, running now, next run), the
todo queue with per-record status and recent completions, the latest librarian
scan per topic (per-article scores and flags), and trend charts.

```
wiki files (source of truth)
  ├─► Cortex tab          browse, search, backlinks
  ├─► todos/ records     health page todo queue
  ├─► .librarian/ scans   health page score table
  └─► hourly sampler ───► health history ───► trend charts
                          (derived, append-only, rebuildable)
```

## Cadence

| Work | Runs | Agent run? |
| --- | --- | --- |
| Ingest | in chat, on request | the current turn |
| Compile | 15-min check; 5+ pending or one ~6h old | one per batch |
| Todos | 15-min check; one record per run, ~45 min apart | one per open todo |
| Librarian | weekly | yes — cost tracks problem density |
| Health history sampler | hourly (no agent) | no |

Audits, source refresh, research runs, outputs, dataset indexing, and topic
archiving run on demand in chat.

## Related Docs

* [Cortex](knowledgebase.md) — browsing, search, backlinks, hub resolution
* [Automations](automations.md) — user automations; wiki maintenance is
  Runtime jobs, not automations
* [Cortex spec](../../specs/cortex.md) — normative design
