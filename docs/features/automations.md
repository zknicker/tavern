---
summary: Scheduled work feature for cron automations, run history, delivery targets, follow-up state, and Runtime ownership.
read_when:
  - changing scheduled work, recurring runs, or automation history
  - changing cron delivery or run history presentation
---

# Automations

Automations let users ask agents to do work later or on a schedule.

## In the box

* **Cron automations.** Recurring agent work runs on a schedule, even while the
  app is closed.
* **Run history.** Past runs stay visible with status, trigger, timing, linked
  chat or turn ids, and failure detail.
* **Delivery targets.** Automation output lands in a chat where the owning
  agent participates, including that agent's DM chat.
* **Follow-up state.** Users can see what ran, what failed, and the next planned
  run.

Automations are entirely user-authored. Tavern's own background work, such as
capability refreshes, runs as Runtime jobs. Memory work belongs to agents
through the managed `memory` skill, not hidden Runtime maintenance.

## Boundary

Tavern Runtime owns automation records, schedule editing, delivery target
validation, run history, next-run state, and chat delivery for automation runs.
