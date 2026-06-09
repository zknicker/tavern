# Cron

Cron jobs are runtime-owned scheduled producers of work surfaced in Tavern.

## Cron Jobs

- A cron job has stable runtime-owned configuration such as name, agent destination, schedule, payload,
  destination, and enabled state.
- A cron job feels like a Tavern routine, not a leaked runtime-specific config fragment.
- Tavern supports recurring cron expressions, recurring interval jobs, and one-time scheduled runs
  when the owning runtime supports them.
- Tavern supports agent-turn cron payloads and system-event cron payloads when the owning runtime
  supports them.
- Delivery is optional. A cron job without a destination remains a valid job.
- Cron job configuration is inspectable independently from run history.
- The owning runtime remains canonical for cron configuration and execution.
- In managed Hermes mode, Tavern Runtime uses Hermes's Cron HTTP API for cron
  create, update, pause/resume, trigger, delete, list, and run-history reads.
- Managed Hermes startup enables Hermes's dashboard cron ticker, so interval
  and cron-expression jobs fire without a separate global Hermes gateway.

## Editing

- Creating, editing, enabling, disabling, running, or deleting a cron job in Tavern calls the owning
  runtime.
- The cron product surface lets a person run a job manually, toggle whether it is enabled,
  and delete it without leaving the cron area.
- If a runtime removes a cron job from an authoritative cron snapshot, Tavern removes the matching
  cron job.
- If the runtime is unavailable, Tavern may keep the last synced snapshot visible, but it does not
  become a second canonical cron config store.

## Cron Runs

- Every cron execution is represented as its own run.
- Cron run history is observed runtime history.
- A manual trigger acknowledgement is not durable run history. Tavern may show
  a local pending row immediately after Run Now, but it disappears on navigation
  and is replaced only by an observed runtime execution.
- A person can inspect historical runs without those runs collapsing into one generic
  latest session.
- Cron runs show status, timing, summary, errors, and related downstream interactions when
  the runtime reports them.
- Live events refresh or invalidate run history; durable run records come from Runtime automation
  storage and APIs.

## Cron Relationships

- A cron run makes it obvious what it triggered.
- If a cron run posted to a destination session, that delivery is visible from the cron run.
- Agent-authored cron delivery appears in the chosen destination chat as the agent when the
  runtime supports destination delivery.
- In managed Hermes mode, Tavern chat delivery uses Hermes platform delivery
  with `deliver=tavern:<chat-id>`. The Tavern Messenger platform plugin posts
  the resulting message to Runtime, and Runtime writes the canonical Tavern
  delivery receipt.
- A person can navigate from a cron run to related session activity quickly.
