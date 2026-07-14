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
* Payloads carry one of three kinds. Agent-turn payloads carry
  `kind: "agentTurn"` and `message`. System-event payloads carry
  `kind: "systemEvent"` and `text`. Script payloads carry `kind: "script"`,
  `command`, and an optional `workingDir` resolved under the owning agent's
  workspace.
* Summaries expose `mode` (the payload kind) so lists can show it without the
  full payload.
* Script runs execute server-side at zero model cost. Exit 0 with empty stdout
  — or a `{"wakeAgent": false}` JSON sentinel — is a quiet tick: the run is
  recorded and nothing posts. Any other stdout is delivered as the automation
  message and dispatches an agent turn exactly like agent-turn payloads.
  Non-zero exits and timeouts record error runs and post nothing.
* Runtime computes `state.nextRunAtMs` for enabled jobs.
* Run history is ordered and durable.
* Runs expose status, trigger, scheduled/start/finish timestamps, `chatId`,
  `turnId`, execution failure detail, and for script runs `quiet`,
  `scriptExitCode`, and `scriptStderr`.
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

Agent turns can use `cron_list`, `cron_create`, `cron_update`, and
`cron_delete` to manage that agent's own automations. These tools create
ordinary automation jobs with agent-turn or script payloads; the jobs remain
fully visible and editable in the Automations page. Agents are taught to
prefer script payloads for watchdogs so quiet ticks cost no model turns.

## Runtime Boundary

Tavern Runtime owns automation records, schedules, delivery target validation,
run history, app-visible follow-up state, and the Agent turn that an automation
triggers.

## Related Docs

* [Automations feature](../features/automations.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
