---
summary: Scheduled work feature for cron automations, run history, delivery targets, follow-up state, and Runtime/Hermes ownership.
read_when:
  - changing scheduled work, recurring runs, or automation history
  - changing cron delivery or run history presentation
---

# Automations

Automations let users ask agents to do work later or on a schedule.

## In the box

* **Cron automations.** Recurring agent work runs on a schedule, even while the
  app is closed.
* **Run history.** Past runs stay visible, including status and delivery.
* **Delivery targets.** Automation output can land in the right chat.
* **Follow-up state.** Users can see what ran, what failed, and what comes next.

Automations are entirely user-authored. Tavern's own background work, such as
highlights and capability refreshes, runs as Runtime jobs. Vault work belongs to
agents through the managed `vault` skill, not hidden Runtime maintenance.

## Boundary

Tavern Runtime owns automation records, schedule editing, delivery targets, run
history, and chat delivery state. Hermes owns the native agent execution that
an automation triggers.
