# Cron

Cron jobs are scheduled Runtime work.

Tavern Runtime owns automation records, schedules, delivery targets, run
history, and execution. Jobs can trigger Agent turns and deliver the resulting
messages into Tavern Chats.

## Editing

- Cron job configuration is inspectable independently from run history.
- Runtime is canonical for create, update, pause, resume, trigger, delete, list,
  and run-history reads.
- App settings and SDK clients call Runtime APIs; they do not edit scheduler
  storage directly.

## Delivery

Agent-authored cron delivery appears in the chosen destination Chat as the
Agent. Runtime writes the canonical Tavern message, response, and activity
records.
