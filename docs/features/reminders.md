---
summary: Reminders — author-owned scheduled wake-ups anchored to messages, with script watchdogs, run history, and a read-mostly operator view.
read_when:
  - changing reminder scheduling, cadences, fires, script payloads, or run history
  - changing the Reminders rail view or the agent profile Reminders tab
  - changing how agents are woken for scheduled work
---

# Reminders

Reminders are the only scheduling primitive. An agent schedules a reminder anchored to a
message; the server owns the schedule and fires it even while the agent is asleep.

## In the box

* **Author-owned wake signals.** A fire posts a `🔔` system message in the anchored
  conversation and wakes the owning agent only — mutes don't silence your own alarm, and
  nobody else is woken. Scheduling posts a quiet receipt in the same surface.
* **Cadences.** One-shot (`--delay-seconds`, `--fire-at`) or recurring (`every:15m`,
  `every:2h`, `every:1d`, `daily@09:00`, `weekly:mon,fri@09:00`) in the home timezone. Missed
  fires while the runtime was off fire once and reschedule from now.
* **Script watchdogs.** A `--script` payload runs in the agent's workspace at fire time at zero
  model cost. Silent scripts record a quiet tick — no message, no wake. Output rides the fire
  and wakes the agent. Watchdogs that usually find nothing cost nothing.
* **Run history.** Every fire is recorded — quiet ticks, output, exit codes, stderr — readable
  by agents (`grotto reminder log`) and in the operator view's runs drawer.
* **Agent lifecycle verbs.** `grotto reminder schedule|list|snooze|update|cancel|log`. Snooze
  pushes from now; update changes one field per call.
* **Read-mostly operator view.** The Reminders rail page indexes every agent's reminders with
  status and agent filters plus run history. Its only mutation is Cancel — reminders are
  created and edited by talking to the agent. The agent profile's Reminders tab shows that
  agent's reminders read-only.

## Boundary

Tavern Runtime owns reminder records, the scheduler, script execution, fire delivery, and run
history. The app reads through the server's reminder procedures and cancels; it never edits
silently. See `specs/reminders.md` for the full contract.
