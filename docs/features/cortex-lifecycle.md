---
summary: How Cortex knowledge flows end to end — ingest to raw sources, compile to articles, scheduled maintenance, escalations, and the health surface.
read_when:
  - understanding how knowledge enters, compiles, and stays healthy in Cortex
  - changing wiki maintenance automations, the compile trigger, escalations, or the health surface
---

# Cortex Lifecycle

Cortex is the agent's durable knowledge: plain Markdown topic wikis. This doc
is the loop in one place — how material you hand the agent becomes compiled,
cross-linked knowledge, and how that knowledge stays healthy without you
reviewing reports.

Four principles shape everything below:

* **Files are the source of truth.** Tavern's database holds only derived,
  rebuildable projections of the wiki — never authoritative state.
* **The page tree stays pure knowledge.** Operational artifacts (scan results,
  reports) live in dot directories and never appear in browsing or search.
* **Maintenance is agent work.** Findings become wiki edits or queued
  follow-ups, not reports for you to review.
* **Escalation is a last resort.** The agent asks you only when no autonomous
  workflow can resolve something, and nothing pings chat uninvited.

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

Ingest is immediate; synthesis is scheduled but never far behind.

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

The gap between ingest and compile costs recall almost nothing: the raw file
holds the full fetched content (article text, video transcript) and is indexed
immediately, so the agent can answer from it before synthesis. Compiling adds
what raw files lack — synthesis across sources, confidence ratings, and links
that weave the concept into existing articles.

So a research dump compiles within the hour, and a stray source or two waits
at most until the next morning's run. Details that keep this calm: a
15-minute settle window lets batch ingests finish before compile fires, a
one-hour cooldown keeps triggers from stacking, and pausing the upkeep
automation pauses the pending-source trigger too. When the agent researches a
topic itself, it compiles inline in the same run — the trigger path exists for
material that arrives without an agent run attached.

## Staying Healthy

Three managed automations divide the upkeep. They are created automatically
once the hub has an active topic, and Runtime repairs any drift hourly.

```
weekly: Wiki lint            weekly: Wiki librarian         daily: Wiki upkeep
│ repairs structure,         │ scores staleness + quality   │ compiles new sources
│ indexes, broken links,     │ repairs what is safe         │ works off up to two
│ missing backlinks          │ files judgment items ───────►│ inventory records,
                             │   as inventory/ records      │ highest priority first
```

The librarian writes machine-readable scan results per topic, then acts on them
in the same run: mechanical problems get fixed, articles with newer uncompiled
sources get recompiled, and judgment items (unverified claims, thin coverage,
dedup candidates) land in `inventory/` as proposed records. The daily upkeep
run drains that queue.

## When The Agent Needs You

```
inventory record the agent cannot resolve autonomously
(claim verification, retraction calls, paid or private access)
                      │  last resort
                      ▼
         record marked for you, with a
         one-line question it can act on
                      │
                      ▼
     Cortex health page card + homepage highlight
                      │  you type a decision
                      ▼
     agent chat (not pinned) applies it to the wiki
```

That is the only human gate in the loop. Everything else drains automatically,
and an unanswered escalation blocks only its own record.

## Watching It Work

The sidebar health card rolls the whole loop into one state — healthy, needs
your call, or hub unreachable. Opening it shows escalation cards, the latest
librarian scan per topic with per-article staleness and quality scores, managed
automation run state, and trend charts.

```
wiki files (source of truth)
  ├─► Cortex tab          browse, search, backlinks
  ├─► escalation records  health cards + homepage highlight
  ├─► .librarian/ scans   health page score table
  └─► hourly sampler ───► health history ───► trend charts
                          (derived, append-only, rebuildable)
```

## Cadence

| Work | Runs | Agent run? |
| --- | --- | --- |
| Ingest | in chat, when you hand the agent material | the current turn |
| Compile check | every 15 minutes (Runtime job) | no — filesystem only |
| Wiki upkeep | daily 4:30, sooner at 5+ pending sources | yes |
| Wiki lint | weekly, Monday 5:00 | yes |
| Wiki librarian | weekly, Saturday 6:00 | yes — cost tracks problem density |
| Health history sampler | hourly (Runtime job) | no |
| Automation reconciler | hourly and at startup (Runtime job) | no |

Deeper workflows — audits, source refresh, research runs, generated outputs,
dataset indexing, topic archiving — run on demand when you ask in chat.

## Related Docs

* [Cortex](knowledgebase.md) — browsing, search, backlinks, hub resolution
* [Automations](automations.md#managed-automations) — the managed automation
  contract and guardrails
* [Cortex spec](../../specs/cortex.md) — normative design
