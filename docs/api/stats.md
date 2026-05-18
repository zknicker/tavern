---
read_when:
  - changing usage, spend, runtime health, or operational stats APIs
  - changing how clients read provider activity or cost signals
---

# Stats API

The Stats API is for usage, spend, runtime health, and operational signal.

Stats are derived from durable records and provider/runtime projections. They do
not require clients to parse logs or runtime internals.

## Contract

* Usage records keep stable timestamps, provider/model identity, and source
  attribution.
* Cost signals are explicit about provider, currency, and estimate status.
* Runtime health is a freshness signal, not a gate for reading durable app data.
* Aggregates point back to source records when useful.
* Realtime events can refresh stats, but reads are the source of truth.

## Surface

The API covers:

* read usage summaries
* read provider and model activity
* read spend estimates
* read runtime health
* read slow, failed, or expensive work signals

## Runtime Boundary

Runtime and providers produce raw activity. Tavern turns that activity into
app-visible usage, spend, and health views.

## Related Docs

* [Stats feature](../features/stats.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
