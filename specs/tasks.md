# Tasks

Tasks are the durable work tracker shared by the user and agents: tasks and
epics with short T-numbers, statuses, priorities, assignees, and labels.

Tavern Runtime owns task records, T-number assignment, task events, agent task
tools, and dispatch. The app renders the board and mirrors records for
sync-first reads. The seeded `tasks` skill teaches agents board etiquette.

This spec covers the board contract and the auto-dispatch design. Auto-dispatch
turns the board from a passive tracker into a work queue: tasks in `todo` with
an agent assignee are picked up and executed without a human pressing Dispatch.

## Board

- One table of tasks and epics (`kind`), one shared T-number sequence.
- Statuses: `backlog`, `todo`, `in_progress`, `blocked`, `review`, `done`,
  `canceled`.
- Assignee is the local user or an agent. Priority orders work: urgent, high,
  medium, low, none.
- The description is the brief: what the task is and how to tell it is done.
  The summary is the outcome, written at close-out. Closing a task never
  overwrites its description.
- Board writes are never gated on agent activity. The user can edit, retitle,
  reprioritize, block, or cancel any task while an agent is mid-turn.

### Status ownership

Statuses move by behavior, not declaration:

- The user moves anything anywhere. `backlog` and `todo` ordering is triage.
- The dispatcher (manual or auto) moves `todo` to `in_progress` when it
  claims a task for an agent.
- The working agent moves its claimed task to terminal states through task
  tools: `done` (or `review` when review is required), `blocked`, or
  `canceled`.
- Recovery rules (below) are the only other writer.

### Manual dispatch

- Dispatch sends a work order into the assignee agent's DM: the T-number,
  title, description, and the standing instruction to keep the task current.
- Manual and auto dispatch share one claim path, so they cannot double-claim
  the same task.

## Agent Contract

- Tools: `tasks_list`, `tasks_get`, `tasks_create`, `tasks_update`. All task
  reads and writes by agents flow through tools, never through direct storage.
- Terminal transitions through `tasks_update` carry a short `summary` — what
  changed, how it was verified, what remains. The summary lands on the task,
  not in the description.
- Setting `blocked` requires a reason and a reason kind:
  - `needs_input` — the user must answer or provide something.
  - `error` — the work failed; the reason carries the failure detail.
- A dispatched turn's first task action is reading the card (`tasks_get`);
  its last is exactly one terminal `tasks_update`. The closing chat reply
  names the T-number and the outcome.
- The seeded `tasks` skill is the doctrine of record; tool descriptions carry
  only the short operational rules.

## Auto-Dispatch

### Eligibility

- A task is eligible when all hold: `kind` is task, status is `todo`, the
  assignee is an agent, and auto-dispatch is enabled globally and for that
  agent.
- `backlog` is never auto-dispatched. Moving a card to `todo` with an agent
  assignee is the go signal. Epics are grouping records and never dispatch.

### Dispatcher

- A Runtime-owned loop beside the cron scheduler, evaluated on an interval
  (default 60s). No engine dependency owns dispatching.
- Claim order: priority first (urgent through none), then oldest `updated_at`.
- A claim is one atomic conditional write (`todo` to `in_progress`, expected
  assignee, attempt recorded). A lost race is a no-op, never a second
  dispatch.
- Claiming sends the same work order as manual dispatch into the agent's DM.
  There is no separate headless execution path: auto-dispatched work is an
  ordinary chat turn, visible, steerable, and stoppable.
- At most one auto-dispatched task runs per agent at a time, and a global
  concurrent-run cap applies (default 1). Both caps must allow a claim. The
  dispatcher never interrupts an agent that is mid-turn for any reason.
- Every dispatch records its trigger (`manual` or `auto`), the dispatching
  turn, and the attempt count on the task.

### Recovery and failure

- Protocol violation: the dispatched turn completes but the task is still
  `in_progress`. Counts as a failed attempt.
- Turn failure or crash: counts as a failed attempt.
- First failed attempt returns the task to `todo`; the second marks it
  `blocked` (`error`) with the failure detail. A broken task cannot thrash.
- User-stopped turns are not failures: stopping a dispatched turn marks the
  task `blocked` (`needs_input`, "stopped by user"). The dispatcher never
  re-claims work the user deliberately halted.
- The dispatcher relies on the Runtime turn lifecycle for liveness. There are
  no separate heartbeats; a turn the Runtime considers live is live.

### Blocked

- The dispatcher skips `blocked` tasks. Moving a task back to `todo` requeues
  it; the human does this after resolving the blocker, or an agent does on
  new information.
- Blocked reasons and kinds appear on the board and in notifications so
  `needs_input` (answer me) reads differently from `error` (fix me).

### Review

- A per-agent `review` policy (default off) routes that agent's completions
  to `review` instead of `done`. The summary and closing reply are written as
  usual; the human moves `review` to `done` after checking the work, or back
  to `todo` with edits to the description for another pass.
- Review is the control for trust-building and for work the user wants to
  check before it counts — completion means ready for review, not reviewed.
- The user can use the `review` column manually regardless of the policy.

### Close-out

- Terminal transitions carry the summary on the task, so the board is
  reviewable without opening the work chat.
- The full work transcript stays in the agent's DM; the task carries the
  outcome, not the process.

### Notifications

- A task created from a chat turn records that chat as its originating chat.
- Terminal transitions of auto-dispatched tasks send one short notification
  message to the originating chat when one exists: the T-number, the terminal
  status, and the first line of the summary. Detail stays pull-based (task
  page, work DM).
- Tasks without an originating chat produce no extra message; the DM close-out
  is the record. Digest-style rollups are ordinary cron automations, not
  dispatcher features.

### Controls

- Auto-dispatch is off by default. Runtime-owned settings:
  - global enable (the kill switch: disabling stops new claims immediately
    and never interrupts in-flight turns),
  - per-agent enable,
  - per-agent review policy,
  - global concurrent-run cap (default 1).
- Concurrency and interval defaults are Runtime settings, not per-task knobs.
- Auto-dispatch grants no new powers. Agents run with the same tools,
  sandbox, and instructions as any chat turn; irreversible-action rules live
  in agent doctrine, not the dispatcher.

### Surfaces

- Per-agent enable and the per-agent review policy live on the agent's
  settings page beside its other capabilities. The global enable and
  concurrent-run cap live in app settings.
- The Tasks page shows whether the board is live: when auto-dispatch is
  enabled, the toolbar carries a compact queue indicator (running and queued
  counts); when disabled, the board shows nothing extra.
- An `in_progress` task whose dispatched turn is running shows a live
  activity indicator on its row and detail page, and links to the work chat.
  Dispatch trigger (`manual` or `auto`) appears on the detail page, not the
  row.
- Blocked rows surface the reason kind so `needs_input` and `error` read
  differently at a glance.
- Queue position is implicit in the board's priority-then-oldest sort. There
  is no separate queue view.

### Capabilities

- Auto-dispatch readiness is a Runtime capability. Apps gate the dispatcher
  settings and queue indicators on it, separate from the base `apiServer`
  gating of the board.

## Out of Scope (Future)

- Parent/child dependencies, auto-promotion, decomposition, and orchestrator
  agents that fan work out to other agents.
- Per-attempt run history rows with structured handoffs; task comment
  threads; attachments.
- A `dependency` blocked kind that waits on linked tasks instead of a human.
- Spend budgets that pause an agent's auto-dispatch at a cap.
- Scheduled tasks (`not before` times) and idempotency keys for
  automation-created tasks.
- Plan-approval gates before execution; goal-mode loops with judges;
  heartbeats; multi-host coordination.
