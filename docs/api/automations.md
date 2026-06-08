---
summary: Scheduled agent work API for durable automations, schedules, delivery targets, run history, failures, and recovery events.
read_when:
  - changing cron automations, scheduled work, delivery targets, or run history APIs
  - changing how external clients create or inspect recurring agent work
---

# Automations API

The Automations API is for scheduled agent work.

Automations are durable app-visible objects. Runs are durable history. Live
progress is activity.

## Contract

* Automation ids are stable.
* Schedules are explicit and inspectable.
* Delivery targets point to Tavern chats or supported output surfaces.
* Run history is ordered and durable.
* Retry, failure, and cancellation states are visible.
* Events notify clients that automation records or runs changed; reads recover
  the full state.

## Surface

The API covers:

* list automations
* get an automation
* create or update a cron automation
* pause or resume an automation
* delete an automation
* list run history
* get a run
* read run delivery and failure details

## Runtime Boundary

Tavern Runtime owns automation records, schedules, delivery targets, run
history, and app-visible follow-up state. Hermes owns the native agent
execution that an automation triggers.

## Related Docs

* [Automations feature](../features/automations.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
