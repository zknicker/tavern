---
summary: How Cortex knowledge flows end to end — ingest to raw sources, compile to articles, scheduled maintenance, escalations, and the health surface.
read_when:
  - understanding how knowledge enters, compiles, and stays healthy in Cortex
  - changing wiki maintenance automations, the compile trigger, escalations, or the health surface
---

# Cortex Lifecycle

Cortex is the agent's durable knowledge: plain Markdown topic wikis. This is
the loop — material in, compiled knowledge out, health maintained without
report review.

Principles:

* **Files are the source of truth.** Tavern's database holds only derived,
  rebuildable projections.
* **The page tree stays pure knowledge.** Operational artifacts live in dot
  directories, hidden from browsing and search.
* **Maintenance is agent work.** Findings become wiki edits or queued
  follow-ups, not reports.
* **Escalation is a last resort.** Nothing pings chat uninvited.

## The Shape

```
hub
└── topics/<topic>/
    ├── raw/          immutable sources — what was ingested, verbatim
    ├── wiki/         compiled articles — synthesized, cross-linked, cited
    ├── inventory/    work queue — proposed follow-ups and escalations
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
                              │ compile — the Wiki upkeep automation
                              │   • daily at 4:30
                              │   • sooner when 5+ sources are pending
                              │     (a 15-minute Runtime check, no agent run)
                              ▼
                   wiki/ articles — synthesized,
                   cross-linked, cited back to raw/
```

The ingest-to-compile gap barely costs recall: raw files hold full fetched
content and are indexed immediately. Compiling adds what raw lacks — synthesis
across sources, confidence ratings, links into existing articles.

Net: research dumps compile within the hour; a stray source or two waits at
most until the next morning. A settle window lets batch ingests finish first,
a one-hour cooldown stops trigger stacking, and pausing upkeep pauses the
trigger. Agent-driven research compiles inline in the same run.

## Staying Healthy

Three managed automations, created once the hub has an active topic, drift-
repaired hourly. Each compile or upkeep write ends with a structural pass over
the wikis it touched, so damage heals in the run that caused it.

```
weekly: Wiki lint            weekly: Wiki librarian         daily: Wiki upkeep
│ deep structural pass:      │ scores staleness + quality   │ compiles new
│ indexes, broken links,     │ repairs what is safe         │ sources, tidies
│ missing backlinks          │ files judgment items         │ what it touched
                             │   as todos ──┐
                                            ▼
                              todos (inventory/ records)
                              worked one at a time: a 15-minute
                              Runtime check runs one agent turn
                              per open todo, spaced by a cooldown
```

The librarian writes machine-readable scan results, then acts in the same run:
mechanical fixes, recompiles where raw already holds newer material, and
judgment items (unverified claims, thin coverage, dedup candidates) filed as
todos. Todo processing drains that queue steadily — one focused agent run per
record, nothing when it is empty — and a todo that keeps failing gets escalated
or marked blocked instead of retrying forever.

## When The Agent Needs You

```
todo the agent cannot resolve autonomously
(claim verification, retraction calls, paid or private access)
                      │  last resort
                      ▼
         todo marked for you, with a
         one-line question it can act on
                      │
                      ▼
     Cortex health page card + homepage highlight
                      │  you type a decision
                      ▼
     agent chat (not pinned) applies it to the wiki
```

The only human gate in the loop. An unanswered escalation blocks only its own
record.

## Watching It Work

The sidebar health card rolls everything into one state — healthy, needs your
call, or hub unreachable. The health page behind it: your todos as question
cards, the agent's todo queue with processing state and next-run time, recent
completions, the latest librarian scan per topic (per-article scores and
flags), automation run state, and trend charts.

```
wiki files (source of truth)
  ├─► Cortex tab          browse, search, backlinks
  ├─► todos               health page queue; yours become question cards
  ├─► .librarian/ scans   health page score table
  └─► hourly sampler ───► health history ───► trend charts
                          (derived, append-only, rebuildable)
```

## Cadence

| Work | Runs | Agent run? |
| --- | --- | --- |
| Ingest | in chat, on request | the current turn |
| Compile check | every 15 minutes (Runtime job) | no — filesystem only |
| Wiki upkeep | daily 4:30, sooner at 5+ pending sources | yes |
| Todo processing | 15-minute check; one todo per run, ~45 min apart | one per open todo |
| Wiki lint | weekly, Monday 5:00 | yes |
| Wiki librarian | weekly, Saturday 6:00 | yes — cost tracks problem density |
| Health history sampler | hourly (Runtime job) | no |
| Automation reconciler | hourly and at startup (Runtime job) | no |

Audits, source refresh, research runs, outputs, dataset indexing, and topic
archiving run on demand in chat.

## Related Docs

* [Cortex](knowledgebase.md) — browsing, search, backlinks, hub resolution
* [Automations](automations.md#managed-automations) — managed automation
  contract and guardrails
* [Cortex spec](../../specs/cortex.md) — normative design
