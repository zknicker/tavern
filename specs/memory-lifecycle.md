# Memory Lifecycle

Tavern memory lifecycle is Cortex page lifecycle.

There is no separate durable memory pool, promotion queue, or memory-record
ranking system. Durable memory lives as Cortex pages, timeline entries, links,
tags, observations, source metadata, embeddings, audit events, and maintenance
state.

## Context Management Boundary

OpenClaw owns the live execution context for turns.

Prompt-time context management helps the agent stay oriented during active
work, but it is not Tavern memory.

Tavern configures managed OpenClaw so this context-management layer is
available and inspectable:

* OpenClaw built-in memory is disabled for Tavern-managed runs.
* Lossless Claw is not installed or enabled for managed Tavern OpenClaw.
* Tavern reports readiness when the Gateway exposes the required capability and
  the managed config matches Tavern's required context-management config.

## Cortex Lifecycle

Cortex owns durable memory and knowledge.

New durable knowledge enters Cortex through explicit capture, page edits,
source imports, agent observations, or maintenance repair. A write can update a
page's compiled truth, append timeline evidence, create or repair links, update
tags, attach citations, and refresh chunks and embeddings.

Cortex material remains inspectable through its provenance. A page can show the
current compiled truth and the timeline evidence that led to it.

## Recall

Cortex recall searches durable knowledge when the active task needs more than
recent prompt context.

Recall ranks over Cortex pages, chunks, links, tags, observations, recency, and
provenance. Ranking metadata belongs to Cortex records and audit events; Tavern
does not create a second memory tier system beside Cortex.

Recall results are bounded, source-linked, and inspectable. Agents receive the
small set of relevant Cortex material, not a dump of raw pages.

## Correction And Forgetting

Corrections are Cortex writes. A correction updates compiled truth, appends
timeline evidence, and records audit history.

Forgetting is explicit and inspectable. Tavern archives, marks, rewrites, or
deletes Cortex material with audit history rather than hiding it through a
separate prompt-block list.

## Maintenance

Cortex maintenance keeps the durable brain usable.

Maintenance can:

* repair stale chunks and embeddings
* rebuild SQLite projections from canonical markdown
* merge or split pages
* repair links and backlinks
* preserve contradictions as timeline evidence
* mark stale or conflicting knowledge
* report failed captures and recall errors

OpenClaw cron is not the scheduler of record for Cortex maintenance. Tavern
Runtime jobs own it.
