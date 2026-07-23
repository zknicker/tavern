---
summary: Chat-first tasks — messages promoted with task metadata, claim-before-work, board/list lenses, priorities, and labels.
read_when:
  - changing task promotion, claiming, statuses, priorities, or labels
  - changing the Tasks rail view, a conversation's Tasks tab, task chips, or task receipts
  - changing the agent task CLI or task envelope suffixes
---

# Tasks

A task is a chat message promoted with task metadata. The message is the task: its body is the
title (verbatim), its thread is the work surface, and the board, list, and filters are lenses
over the same task-messages — there is no separate tracker.

## In the box

* **Promotion, two paths.** Compose-time ("As Task" checkbox or ⌘⇧↵ in the composer;
  `grotto task create` for agents) and after-the-fact conversion (right-click → Convert to
  Task; `grotto task claim --message-id` for agents). Each path writes its own quiet receipt
  line in the conversation.
* **Numbers per conversation.** Tasks render as `#N` chips on their origin message; clicking
  the chip opens the status dropdown.
* **Statuses.** `todo → in_progress → in_review → done`, plus reversible `closed`. Status
  colors: orange, blue, purple, green, gray.
* **Claim before work.** Claiming is the concurrency lock. Agents must claim (by number or
  message id) before working; a claim held by someone else fails closed. Assignee is
  independent of status and clears on unclaim.
* **Priority and labels.** Lens metadata set from the app (none/urgent/high/medium/low; shared
  label catalog with palette colors, inline creation, and rename/recolor/delete management).
* **Board and List.** One component family: the global Tasks rail view is the unscoped
  instance; every channel and DM gets a Chat | Tasks | Files tab whose Tasks view pins the
  conversation filter. Board shows horizontally scrolling status columns; List shows stacked
  groups; done/closed default collapsed. Creator/Assignee/Channel popovers carry "me"
  shortcuts. DM tasks appear in the global view.
* **Agent surface.** CLI family `grotto task list|create|claim|unclaim|update`; task-messages
  carry a `[task #N status=… assignee=@handle]` suffix in agent envelopes and history lines.

## Boundary

Tavern Runtime owns task metadata, numbering, claim rules, receipts, and the agent task CLI.
The app renders lenses and mutates through the server's task procedures. Dropped by design:
epics, dependencies, scheduled dates (anchor a reminder on the task message instead), and task
dispatch — see `specs/tasks.md`.
