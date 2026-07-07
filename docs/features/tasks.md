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
* **Status and priority.** Status is backlog, todo, in progress, done, or
  canceled. Priority is none, urgent, high, medium, or low. The Active view
  covers todo plus in progress.
* **Assignees.** A task is unassigned, owned by the user, or assigned to an
  agent.
* **Labels.** Freeform comma-separated labels for ad-hoc grouping.
* **Agent task tools.** Agents list, read, file, and update tasks from chat
  with their `tasks_*` tools, including marking work in progress and done.
* **Managed tasks skill.** A seeded `tasks` skill teaches board etiquette:
  when to file tasks, status hygiene, dispatched-task handling, and epics.
  It is enabled for agents by default and resettable to the Tavern default.
* **Dispatch to agent.** From a task's detail page, dispatch sends the task
  into the chosen agent's direct chat and assigns it, so the work happens in
  the room.

The Tasks page lives beside Automations in the sidebar. Automations are
scheduled runs; Tasks are tracked outcomes.

## Boundary

Tavern Runtime owns canonical task records, T-number assignment, task events,
and the agent task tools. Tavern App mirrors task records for sync-first reads
and renders the Tasks views; create, update, delete, and dispatch flow through
the Runtime.
