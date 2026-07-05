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
* Every cron automation has an owning `agentId`.
* Schedules are explicit and inspectable.
* Delivery targets are required and point to a Tavern chat where the owning
  agent participates.
* Agent-turn payloads carry only `kind: "agentTurn"` and `message`.
* Runtime computes `state.nextRunAtMs` for enabled jobs.
* Run history is ordered and durable.
* Runs expose status, trigger, scheduled/start/finish timestamps,
  `chatId`, `turnId`, and execution failure detail.
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
* read run chat linkage and failure details

## Runtime Boundary

Tavern Runtime owns automation records, schedules, delivery target validation,
run history, app-visible follow-up state, and the Agent turn that an automation
triggers.

## Related Docs

* [Automations feature](../features/automations.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
