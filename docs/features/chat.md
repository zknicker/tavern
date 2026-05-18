---
read_when:
  - changing the main agent conversation experience
  - changing durable messages, live activity, receipts, or timeline recovery
---

# Chat

Chat is Tavern's primary workspace. Users talk to one or more agents, watch work
happen, and keep the durable timeline as context.

## In the box

* **Durable messages.** User, assistant, and system rows are stable history.
* **Live activity.** Tool calls, thinking summaries, and draft assistant text
  render while work is happening.
* **Receipts.** Message creation and assistant delivery are acknowledged by id.
* **Offline catch-up.** Tavern Runtime keeps chat history while the app is
  closed; the app reloads from durable rows and event cursors.

## Timeline inputs

The timeline combines three inputs:

| Input | Owner | Role |
| --- | --- | --- |
| Durable messages | Tavern Runtime | Canonical timeline rows |
| Activity | Tavern API and runtime events | Active assistant work |
| Optimistic local rows | App UI | One-frame accepted-message handoff |

Rendering rules:

* key user rows by durable message id
* key assistant rows by durable message id or delivery id
* key active tool rows by activity id and step id
* append deltas only to the active assistant draft
* never create a durable row from activity alone
* replace optimistic rows by durable message id
* recover reloads from runtime durable message history first

## Contract

The feature contract lives in [Chat API](../api/chat.md).
