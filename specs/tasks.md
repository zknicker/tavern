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
- Tasks can depend on other tasks (`blockedBy` edges, task-to-task only).
  A task with an unfinished dependency is waiting: it keeps its status and
  shows what it waits on. Cycles are rejected at write time. There is no
  parent/child hierarchy and no automatic status motion from edges.
- Labels are first-class records modeled after Linear: a unique name and a
  color from the app palette. Tasks reference labels; the board filters by
  them. Labels are the lightweight way to tag a domain, product, or SKU.
  New labels are created inline from the label picker; rename, recolor,
  and delete live on a small labels management surface. Deleting a label
  removes it from its tasks. Label groups are out of scope.
- A task can carry a `scheduledFor` date: the earliest it should be worked.
  A dated task is waiting until its date arrives, exactly like an unmet
  dependency — it keeps its status and is skipped by the dispatcher.
  Scheduling gates dispatch, never triage: promotion and edits work as
  always. Crons remain the tool for recurring roles; `scheduledFor` is for
  one-shot dated work.

### Attachments

- The description and summary render as markdown, including images.
- Attaching promotes. An agent attaches deliverables by workspace path at
  close-out — it wrote the files, it knows the paths — and Runtime copies
  each named file into the task's folder under the Runtime-owned artifacts
  root, outside any agent workspace. The task references the promoted
  copy, never the live workspace file: a path is a claim, a promoted copy
  is a fact. Agents stay free to reorganize and clean their workspaces
  without breaking the board.
- An attachment records filename, media type, byte size, and its source.
  Task rows stay light — pointers and summaries, never blobs; bytes live
  in the artifacts root on disk.
- There is no asset URL server. The app reads attachment bytes through
  Runtime APIs and renders them inline, the same way chat artifact
  previews work today. Image attachments render inline on the task page,
  so a design task's outputs are reviewable exactly where the `review`
  decision happens; summary markdown can embed an attachment by filename.
- The artifacts root is the one heavy directory in Runtime state. Light
  state — the runtime database and workspace text — backs up cheaply
  without it, and the artifacts root can later move to object storage as
  a storage-provider change, not a product change.
- Board writes are never gated on agent activity. The user can edit, retitle,
  reprioritize, block, or cancel any task while an agent is mid-turn.

### Status ownership

Statuses move by behavior, not declaration:

- The user moves anything anywhere. `backlog` and `todo` ordering is triage.
- Only the user moves a task into `todo`. Agent-created tasks always enter
  `backlog` for triage, and agent tools cannot set `todo`. Human promotion
  is the sole path into the auto-dispatch queue, so an agent filing work
  for itself can never queue it — recursive self-dispatch is structurally
  impossible.
- The dispatcher (manual or auto) moves `todo` to `in_progress` when it
  claims a task for an agent.
- The working agent moves its claimed task to terminal states through task
  tools: `done` (or `review` when review is required), `blocked`, or
  `canceled`.
- Recovery rules (below) are the only other writer.

### Manual dispatch

- Dispatch sends a work order into the task's work chat: the T-number,
  title, description, and the standing instruction to keep the task current.
- Manual and auto dispatch share one claim path, so they cannot double-claim
  the same task.
- Manual dispatch is a human override: it ignores dependency holds.

## Work Chats

Dispatched work runs in a dedicated task chat, not the agent's DM.

- A task chat is an ordinary Runtime chat with scope `task`, titled by the
  T-number and title, holding the user and the assignee agent. No new
  conversation primitive: everything a chat supports — visible turns,
  steering, stopping, sessions — works unchanged.
- The chat is created on first dispatch and reused by every later attempt,
  so one task accumulates one transcript across retries. Reassigning the
  task adds the new assignee to the same chat; history stays in place.
- The task records its work chat and the task page links to it. Task chats
  are grouped apart from DMs and channels in the chat list and auto-archive
  when the task reaches a terminal status; archived task chats stay
  reachable from the task page.
- Per-task chats keep batch work in separate contexts (ten tasks, ten
  transcripts) and are the prerequisite for a concurrent-run cap above one.

## Agent Contract

- Tools: `tasks_list`, `tasks_get`, `tasks_create`, `tasks_update`. All task
  reads and writes by agents flow through tools, never through direct storage.
- `tasks_create` and `tasks_update` accept dependencies by T-number, so an
  agent decomposing a batch can file ordered work in `backlog` for the user
  to promote as one chain.
- `tasks_create` always files into `backlog`; `tasks_update` cannot set
  `todo` (see status ownership).
- Terminal transitions through `tasks_update` carry a short `summary` — what
  changed, how it was verified, what remains. The summary lands on the task,
  not in the description. When the work produced files, the transition
  attaches the key ones by workspace path; Runtime promotes the copies
  (see Attachments). Work files belong in the workspace `workbench/`
  directory — scratch the agent may clean freely once deliverables are
  attached.
- Agents apply labels by name. An unknown label name creates the label
  with an auto-assigned color, so an agent can mint a new SKU tag without
  a round-trip through the user.
- Agents set `scheduledFor` when filing dated follow-ups ("check the ad
  performance of X next week"); like all agent-created tasks these land in
  `backlog` for the user to promote.
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
  assignee is an agent, every dependency is `done`, its `scheduledFor` (when
  set) has arrived, and auto-dispatch is enabled globally and for that
  agent.
- `backlog` is never auto-dispatched. Moving a card to `todo` with an agent
  assignee is the go signal. Epics are grouping records and never dispatch.
- A `todo` task with unmet dependencies or a future `scheduledFor` is
  waiting, not hidden: it keeps its status and becomes claimable the moment
  its last dependency closes or its date arrives, so a chain staged in
  `todo` executes in order. A `canceled` dependency never satisfies the
  edge; the dependent stays held for the user to re-triage.

### Dispatcher

- A Runtime-owned loop beside the cron scheduler, evaluated on an interval
  (default 60s). No engine dependency owns dispatching.
- Claim order: priority first (urgent through none), then oldest `updated_at`.
- A claim is one atomic conditional write (`todo` to `in_progress`, expected
  assignee, attempt recorded). A lost race is a no-op, never a second
  dispatch.
- Claiming sends the same work order as manual dispatch into the task's
  work chat. There is no separate headless execution path: auto-dispatched
  work is an ordinary chat turn, visible, steerable, and stoppable.
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
  it; only the human does this, after resolving the blocker.
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
- The full work transcript stays in the task's work chat; the task carries
  the outcome, not the process.

### Notifications

- A task created from a chat turn records that chat as its originating chat.
- Terminal transitions of auto-dispatched tasks send one short notification
  message to the originating chat when one exists: the T-number, the terminal
  status, and the first line of the summary. Detail stays pull-based (task
  page, work DM).
- Tasks without an originating chat produce no extra message; the work-chat
  close-out is the record. Digest-style rollups are ordinary cron
  automations, not dispatcher features.

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
- A waiting `todo` task shows the T-numbers it waits on or its
  `scheduledFor` date; dependencies and scheduling are edited from the task
  detail sidebar.
- The board offers a calendar view laid out by `scheduledFor`: dated work —
  planned designs, follow-up checks, agent-suggested work for coming weeks —
  week by week. The calendar reads the board only; external calendar sync
  is future plugin plumbing.
- Rows support multi-select with bulk actions: set status (including
  promoting a staged chain to `todo` in one move), assignee, priority,
  epic, labels, and cancel.
- Queue position is implicit in the board's priority-then-oldest sort. There
  is no separate queue view.

### Capabilities

- Auto-dispatch readiness is a Runtime capability. Apps gate the dispatcher
  settings and queue indicators on it, separate from the base `apiServer`
  gating of the board.

## Out of Scope (Future)

- Parent/child hierarchy, subtasks, and orchestrator agents that fan work
  out to other agents.
- Per-attempt run history rows with structured handoffs; task comment
  threads.
- Spend budgets that pause an agent's auto-dispatch at a cap.
- Idempotency keys for automation-created tasks.
- Two-way calendar sync (e.g. the Google Calendar plugin) for scheduled
  tasks; the calendar view is board-only until then.
- Label groups.
- Object-storage or CDN backends for the artifacts root; local disk is the
  only provider for now.
- Plan-approval gates before execution; goal-mode loops with judges;
  heartbeats; multi-host coordination.
