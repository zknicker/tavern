# Cron

Cron jobs are user- and agent-authored scheduled automations.

Tavern Runtime owns automation records, schedules, delivery targets, run
history, and execution. A cron job triggers an Agent turn on schedule and
delivers the resulting messages into a Tavern Chat.

Cron jobs are not system maintenance. Extraction, dreaming, skill review, and
curation run as Runtime workers, never as managed cron jobs.

## Scheduling

- Runtime stores cron jobs durably and evaluates schedules itself. No engine
  dependency owns scheduling.
- Schedules support cron expressions and simple intervals.
- Runtime computes and exposes the next planned run for every enabled job.
- A window missed while Runtime was offline runs at most once on recovery; it
  does not backfill.

## Editing

- Cron job configuration is inspectable independently from run history.
- Runtime is canonical for create, update, pause, resume, trigger, delete,
  list, and run-history reads.
- App settings and SDK clients call Runtime APIs; they do not edit scheduler
  storage directly.

## Delivery

- A cron job has no originating chat. Every job names an owning Agent and an
  explicit delivery target.
- Valid delivery targets: a Chat the owning Agent participates in, or that
  Agent's DM channel.
- Runtime validates the target at create and update, and again at run time. A
  target invalid at run time fails the run with clear detail; Runtime never
  invents a delivery target.
- Delivery appears in the destination Chat as the Agent. Runtime writes the
  canonical Tavern message, response, and activity records.

## Agent Authoring

- Agents manage cron jobs with cron tools: `cron_create`, `cron_list`,
  `cron_update`, and `cron_delete`.
- Agent-authored jobs may only target Chats the agent participates in or its
  own DM channel.
- Agent-created jobs are ordinary cron jobs: fully visible and editable in the
  Cron settings page. There is no hidden automation.

## Runs

- Runs are durable with timing, outcome, delivered-message linkage, and
  failure detail.
- Run history and next planned runs are readable through Runtime APIs and
  shown in the Cron page.

## Capabilities

- Cron readiness is a Runtime capability. Apps gate cron surfaces on it.
