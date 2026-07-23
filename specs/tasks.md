# Tasks

Chat-first tasks (D8 in `specs/raft-alignment/README.md`; supersedes the retired pre-flip
tracker). A task is a chat message promoted with task metadata — the message IS the task, its
thread is the work surface, and every board, list, or filter view is a lens over task-messages,
never a second store.

## Model

- `message_tasks` (runtime SQLite) keys task metadata by message id: per-conversation `number`
  (rendered `#N`), `status`, `assignee_id` + `claimed_at`, `priority`, `label_ids_json`,
  `origin` (`composed` | `converted`), `created_by`. `ChatMessage.task` carries the projection
  on every read; agent surfaces append the `[task #N status=… assignee=@handle]` envelope
  suffix.
- Statuses: `todo → in_progress → in_review → done`, plus reversible `closed`. Assignee is
  independent of status; a task can be claimed or unclaimed at any status except `done`.
- Only top-level channel/DM messages can become tasks. Thread messages are discussion; system
  messages are ineligible. One task per message, numbers per conversation.
- Priority (`none|urgent|high|medium|low`) and shared labels (catalog table, deleted labels
  self-heal off tasks at read time) are app-lens metadata; the agent CLI does not set them.

## Claim is the concurrency lock

- `grotto task claim` by number, or by message id (which converts a regular message and claims
  it in one step). Claiming a `todo` task moves it to `in_progress` with a claim timestamp.
  A claim on a task assigned to someone else fails; the caller must not work it.
- `task create` posts a fresh message and publishes it as a task (`--title` repeatable for
  batches; stdin body otherwise). `--assignee` self only on the agent surface: self-assignment
  creates the task claimed (`in_progress`); reservation of others is an operator affordance.
- Unclaim releases assignee + claim timestamp and leaves status unchanged.

## Receipts

System messages (`sys_task` author, quiet centered rendering) with copy conditioned on path,
Raft parity:

- compose-time: `📋 1 new task created: #1 "…"` (count-aggregated for batches)
- conversion: `📋 @actor converted a message to task #1 "…"` (title truncated ~40 chars)
- reservation: `📋 task #N assigned to @handle: "…"` — the personal @mention pierces mutes.

Status changes emit no receipts; they ride `message.updated` events.

## Surfaces

- Agent CLI family 5 (`task list|create|claim|unclaim|update`) over `/api/agent/tasks/*`.
- App: global Tasks rail view (unscoped) and per-conversation Chat | Tasks | Files tab (chat
  filter pinned) render ONE component family; Board (status columns, done/closed collapsed) and
  List (stacked groups) views; Creator/Assignee/Channel filter popovers with "me" shortcuts;
  task chip on the origin message opens the 5-status dropdown; composer "As Task" checkbox with
  ⌘⇧↵; right-click Convert to Task. Task title is always the origin message body verbatim.
- DM tasks appear in the global view by construction (U4 — the unscoped query is the aggregate;
  Raft's silent DM exclusion is a bug we do not copy).

## Dropped by design (D8)

Epics, dependency edges, `scheduledFor`/calendar (anchor a reminder on the task message
instead), attachment promotion, per-task work chats, auto-dispatch, `tasks_*` tools,
`workbench/tasks/…` folders, T-numbers.
