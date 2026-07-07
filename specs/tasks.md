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
- Statuses: `backlog`, `todo`, `in_progress`, `done`, `canceled`, and (with
  auto-dispatch) `blocked`.
- Assignee is the local user or an agent. Priority orders work: urgent, high,
  medium, low, none.
- Manual dispatch sends a work order into the assignee agent's DM and marks
  the task assigned to that agent. Work happens in the chat; the closing reply
  names the T-number and the outcome.

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
- Claiming sets the task `in_progress` and sends the same work order as manual
  dispatch into the agent's DM. There is no separate headless execution path:
  auto-dispatched work is an ordinary chat turn, visible, steerable, and
  stoppable.
- At most one auto-dispatched task runs per agent at a time, and a global
  concurrent-run cap applies (default 1). The dispatcher never interrupts an
  agent that is mid-turn for any reason.
- Recovery: if the dispatching turn ends without the task leaving
  `in_progress`, the dispatcher returns the task to `todo` once. On the second
  failed attempt it marks the task `blocked` with the failure detail, so a
  broken task cannot thrash.

### Blocked

- `blocked` is a first-class status with a required reason recorded on the
  task.
- Agents set it through `tasks_update` when work cannot proceed (missing
  input, missing access, dependency), stating the blocker in the reason and in
  the closing chat reply.
- The dispatcher skips `blocked` tasks. A human (or an agent, on new
  information) moves the task back to `todo` to requeue it.

### Close-out

- Terminal transitions (`done`, `blocked`, `canceled`) should carry a short
  summary, recorded on the task and shown on the task detail page, so the
  board is reviewable without opening the work chat.
- The full work transcript stays in the agent's DM; the task carries the
  outcome, not the process.

### Notifications

- A task created from a chat turn records that chat as its originating chat.
- Terminal transitions of auto-dispatched tasks send one short notification
  message to the originating chat when one exists: the T-number, the terminal
  status, and the summary line. Detail stays pull-based (task page, work DM).
- Tasks without an originating chat produce no extra message; the DM close-out
  is the record. Digest-style rollups are ordinary cron automations, not
  dispatcher features.

### Controls

- Auto-dispatch is off by default. A Runtime-owned setting enables it
  globally; a per-agent flag opts each agent in.
- The global setting is the kill switch: disabling it stops new claims
  immediately and never interrupts in-flight turns.
- Concurrency caps (global and the per-agent single-task rule) are Runtime
  settings with safe defaults, not per-task knobs.
- Auto-dispatch grants no new powers. Agents run with the same tools,
  sandbox, and instructions as any chat turn; irreversible-action rules live
  in agent doctrine, not the dispatcher.

### Capabilities

- Auto-dispatch readiness is a Runtime capability. Apps gate the dispatcher
  settings and queue indicators on it, separate from the base `apiServer`
  gating of the board.

## Out of Scope (Future)

- Parent/child task dependencies and auto-promotion.
- Per-attempt run history with structured handoffs; comment threads on tasks.
- Heartbeats, goal-mode loops, and multi-host coordination.
