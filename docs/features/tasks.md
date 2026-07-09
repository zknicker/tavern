---
summary: Tasks feature for tracked tasks and epics shared by the user and agents, T-numbers, agent task tools, and dispatch-to-agent.
read_when:
  - changing the Tasks page, task detail, statuses, priorities, epics, or labels
  - changing agent task tools or how agents read and update tracked work
  - changing dispatch-to-agent or task assignment behavior
---

# Tasks

Tasks are Tavern's built-in work tracker: lightweight tasks and epics shared by
the user and agents.

## In the box

* **Tasks and epics.** One tracker with two kinds. Epics group related tasks so
  bigger pushes stay legible.
* **T-numbers.** Every task gets a short sequential number (T-1, T-2, ...) that
  works as a reference in chat messages.
* **Status and priority.** Status is backlog, todo, in progress, blocked,
  review, done, or canceled. Priority is none, urgent, high, medium, or low.
  The Active view covers todo, in progress, blocked, and review — everything
  live or demanding attention.
* **Assignees.** A task is unassigned, owned by the user, or assigned to an
  agent.
* **Dependencies.** `blockedBy` records the tasks a task waits on. Waiting
  tasks keep their status, dispatch only after dependencies are done, and
  dependency cycles are rejected.
* **Scheduling.** `scheduledFor` is a YYYY-MM-DD date for one-shot follow-ups.
  Scheduled tasks wait until that day before dispatch can claim them.
* **Labels.** Shared label records with palette colors tag domains, products,
  and SKUs. Tasks carry full label objects, labels can be created inline from
  the picker, and the labels management surface supports rename, recolor, and
  delete. Deleting a label removes it from its tasks.
* **Agent task tools.** Agents list, read, file, and update tasks from chat
  with their `tasks_*` tools. Agent-created tasks land in backlog for user
  triage; only the user promotes tasks into todo.
* **Managed tasks skill.** A seeded `tasks` skill teaches board etiquette:
  when to file tasks, status hygiene, dispatched-task handling, and epics.
  It is enabled for agents by default and resettable to the Tavern default.
* **Dispatch to agent.** From a task's detail page, dispatch assigns the task
  and sends the work order into a dedicated task chat. The work chat is created
  on first dispatch, reused across later attempts, adds a new assignee on
  reassignment, auto-archives when the task closes, and remains reachable from
  the task page.

The Tasks page lives beside Automations in the sidebar. Automations are
scheduled runs; Tasks are tracked outcomes.

Descriptions are the work brief. Summaries are the close-out outcome: what
changed, how it was checked, and what remains. Blocking reasons distinguish
`needs_input` from `error` so the board shows whether the user must answer or
the work failed.

## Boundary

Tavern Runtime owns canonical task records, T-number assignment, task events,
and the agent task tools. Tavern App mirrors task records for sync-first reads
and renders the Tasks views; create, update, delete, and dispatch flow through
the Runtime.
