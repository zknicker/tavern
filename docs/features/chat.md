---
summary: Agent chat experience for durable messages, responses, activity, artifacts, receipts, offline catch-up, optimistic rows, and rendering rules.
read_when:
  - changing the main agent conversation experience
  - changing durable messages, responses, activity, artifacts, receipts, or timeline recovery
---

# Chat

Chat is Tavern's primary workspace. Users talk to one or more agents, watch work
happen, and keep the durable timeline as context.

## In the box

* **Durable messages.** User, assistant, and system rows are stable history.
* **Responses.** Agent work is grouped as a response to a message, with durable
  status from queued through completion or failure.
* **Activity.** Tool calls, thinking summaries, commands, approvals, snippets,
  and generated outputs render while work is happening and after completion.
  Tool rows open the same detail drawer whenever the runtime exposes a tool call
  id.
* **Artifacts.** Code, images, files, diffs, documents, and charts render as
  durable outputs attached to messages or response activity.
* **Receipts.** Message creation and assistant delivery are acknowledged by id.
* **Chat tabs.** Pinned chats always appear first in the topbar. Unpinned chats
  appear only while locally open during the current app session, sorted by chat
  creation time. Restarting the app clears unpinned topbar tabs without
  archiving them. `Cmd+T` opens the new-chat surface; `Cmd+W` or a tab close
  button removes the current unpinned chat from the topbar. The overflow chat
  menu can reopen any non-archived chat.
* **Pinned chats.** Users can pin durable chats as focus-area homes. Pinned
  chats stay in the tab strip, survive app restarts, and can carry a custom
  tab color.
* **Offline catch-up.** Tavern Runtime keeps chat history while the app is
  closed; the app reloads from durable rows and refetches on reconnect.
* **Mid-turn steering.** The chat composer stays available while an agent turn
  is running. OpenClaw owns active-run behavior and Tavern configures normal
  mid-turn messages to steer the active run by default.

## Timeline inputs

The timeline combines three inputs:

| Input | Owner | Role |
| --- | --- | --- |
| Durable messages | Tavern Runtime | Canonical timeline rows |
| Responses and activity | Tavern Runtime | Agent work and progress |
| Artifacts | Tavern Runtime | Rich renderable outputs |
| Optimistic local rows | App UI | One-frame accepted-message handoff |

Rendering rules:

* key user rows by durable message id
* key assistant rows by durable message id or delivery id
* key response rows by response id
* key activity rows by activity id
* open activity details by activity id, then load the durable row from the Chat API
* key artifacts by artifact id
* update running activity rows in place
* replace optimistic rows by durable message id
* recover reloads from Runtime messages, responses, activity, and artifacts

## App Data Flow

The app reads chat list and detail data separately. `chat.list` is the
lightweight ordered list contract for Tavern sidebars, overviews, and chat
pickers. Agent pages use `agent.chats.list` when they need the combined Tavern
and external runtime chat inventory.
`chat.get` is the focused detail read for a single chat. Timeline rows come from
`chat.log.list`, including durable messages, responses, activity, and artifacts.

Runtime progress and reply events update response and activity rows by stable
ids. They should not create a second volatile progress transcript.

When OpenClaw accepts a mid-turn steer, Runtime records a `runtimeNotice`
activity row. Tavern App renders it as a system row in the same notice style as
runtime session and compaction notices.

## Pinned chats

Pinned chat state is durable Tavern Runtime chat state. It survives app
reinstall and syncs through the normal chat list/detail reads. Pinning changes
tab grouping only; it does not change chat membership, message ordering,
response delivery, or archive behavior. Pinned tab color is durable Tavern chat
metadata.

## Contract

The feature contract lives in [Chat API](../api/chat.md).
