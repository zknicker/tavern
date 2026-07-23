# Reminders

The only scheduling primitive (D4 in `specs/raft-alignment/README.md`; the cron/automations
product is retired). A reminder is an author-owned, persistent, observable, snoozable,
updatable, cancelable wake-up signal anchored to a message.

## Model

- `reminders` (runtime SQLite): `rem_*` id, `owner_agent_id`, `title`, anchor chat + message,
  `fire_at_ms`, optional `repeat` cadence, optional `script`, status
  `scheduled | fired | canceled`. `reminder_runs` records every fire, including quiet ticks
  (`outcome fired|quiet|error`, output, exit code, stderr, fire message id).
- Cadences: `every:15m|every:2h|every:1d`, `daily@HH:MM`, `weekly:mon,fri@HH:MM` — wall-clock
  cadences resolve in the home timezone. Late fires (runtime was off) fire once and advance
  from now, never a burst.
- Schedules are server-owned: the runtime scheduler ticks every 15s; nothing depends on the
  owning agent's process staying alive.

## Fire semantics

- Fire = a `🔔 Reminder: <title>` system message (`sys_reminder`) in the anchored surface plus a
  wake for the owner ONLY — the fire pierces the owner's mutes (your own alarm ignores
  attention state) and never enters ordinary delivery for other agents. Everyone else sees the
  fire only by reading the surface: wake ownership does not transfer.
- Scheduling posts a quiet receipt in the anchored surface
  (`🔔 @owner scheduled a reminder: "…" (fires …)`); receipts wake nobody.
- `--script` payloads run in the owner's workspace at fire time at zero model cost (60s cap,
  16KB output cap): empty stdout = quiet tick (run row only, no message, no wake); output rides
  the fire message and wakes the owner. Non-zero exits record `error`; output still earns the
  wake.

## Surfaces

- Agent CLI family 8 (`reminder schedule|list|snooze|update|cancel|log`) over
  `/api/agent/reminders/*`. Schedule requires an anchor `--message-id` the caller can see;
  update changes exactly one field; snooze pushes `--by 30m|2h|1d` from now.
- App: the Reminders rail view is a read-mostly cross-agent operator index (ported automations
  page anatomy: status/agent filter sidebar, rows, run-history drawer ≈ `reminder log`) whose
  only mutation is Cancel — reminders are created and edited conversationally. The agent
  profile Reminders tab shows that agent's reminders read-only.
