---
summary: Decision to make author-owned, message-anchored reminders the only scheduling primitive, retiring the cron/automations product; script payloads keep zero-cost watchdog economics.
read_when:
  - changing reminder scheduling, cadences, fires, script payloads, or run history
  - changing how agents are woken for scheduled work, or adding any recurring-work surface
  - reading the history behind the cron/automations retirement
---

# ADR 0016: Reminders Are the Scheduling Primitive

## Status

Accepted (2026-07-22, WS5 of the Raft-alignment program; decision D4 in
`specs/raft-alignment/README.md`, ruled 2026-07-20/21). Replaces the cron
automations product deleted at the flip (ADR 0014).

## Decision

`grotto reminder schedule/list/snooze/update/cancel/log` with Raft semantics:
a reminder is author-owned, anchored to a message the author can see, and
server-owned — the runtime scheduler fires it whether or not the owning agent
is awake. A fire posts a `🔔` system message in the anchored surface and wakes
only the owner: the fire pierces the owner's own mutes and never enters
ordinary delivery for anyone else (wake ownership does not transfer).
Recurring cadences (`every:*`, `daily@HH:MM`, `weekly:days@HH:MM`) resolve in
the home timezone; late fires fire once and advance from now.

The Grotto extension over Raft: an optional `--script` payload runs in the
owner's workspace at fire time at zero model cost. Empty output is a quiet
tick — logged in run history, no message, no wake. Output rides the fire.
This preserves the retired cron product's watchdog economics.

## Consequences

- Cron agent-turn mode is replaced by conversational reminders; system-event
  mode is subsumed (a fire IS a scheduled system message). `cron_jobs`/
  `cron_runs` left the fresh schema.
- The Automations page became the read-mostly Reminders operator view:
  status/agent filters and run history, with Cancel as the only mutation —
  reminders are created and edited by talking to the agent.
- Runtime-native wake tools are not a substitute: the prompt teaches
  reminders precisely because they are observable, snoozable, and cancelable
  by everyone in the surface.
