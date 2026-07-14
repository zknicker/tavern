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
* **Script watchdogs.** A script-mode automation runs a shell command
  server-side at zero model cost. Whatever the script prints is delivered into
  the chat and wakes the agent; a run that prints nothing is a quiet tick that
  posts nothing and only shows up in run history. Scripts run in the owning
  agent's workspace with the same local trust as the agent's own shell, with a
  capped runtime and output size.
* **Run history.** Past runs stay visible with status, trigger, timing, linked
  chat or turn ids, and failure detail. Script runs also record quiet ticks,
  exit codes, and stderr.
* **Delivery targets.** Automation output lands in a chat where the owning
  agent participates, including that agent's DM chat.
* **Follow-up state.** Users can see what ran, what failed, and the next planned
  run.

The Automations page shows each automation's mode. The editor edits the agent
prompt, the script command and working directory, or the system-event text
depending on the selected run type.

Users and agents can author automations. Agent-created automations are ordinary
jobs: they deliver into chats where the agent participates and stay fully
visible and editable in the Automations page.

Tavern's own background work, such as capability refreshes, runs as Runtime
jobs. Memory work belongs to agents through the managed `memory` skill, not
hidden Runtime maintenance.

## Boundary

Tavern Runtime owns automation records, schedule editing, delivery target
validation, run history, next-run state, and chat delivery for automation runs.
