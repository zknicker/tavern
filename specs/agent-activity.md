---
summary: Agent activity feed — a durable, turn-grained log of what an agent has been doing, shown in the agent profile's Activity tab and avatar hover card.
read_when:
  - changing the agent profile, avatar hover cards, or any agent activity feed
  - changing turn lifecycle records, triggers, or outcome projection
  - considering finer-grained (tool-level) agent status surfaces
---

# Agent Activity

[Presence](presence.md) answers "is the agent busy right now". The activity
feed answers "what has this agent been doing" — a short, human-readable log
of turn-grained moments, in the spirit of Raft's activity diagnostics but
with more context: every entry says where it happened and, when known, why.

The feed is a **projection over durable rows** — turn records and session
notices Runtime already keeps — never a new event stream and never a new
table. It is fetched when a surface opens, kept fresh by the same turn
events that invalidate presence, and it survives reload because its sources
are durable.

## Entry catalog

This catalog is the rendering contract. Implementations must produce
exactly these entry kinds with these label shapes; label copy lives in one
module whose unit tests mirror this table.

| Kind | Label template | Source |
| --- | --- | --- |
| `message_received` | `Message received in <chat> — from <sender>` | Turn with a message trigger: anchor chat + trigger message author |
| `replied` | `Replied in <chat>` | Turn completed with a delivered reply |
| `declined` | `Chose not to reply in <chat>` | Turn completed silently (`NO_REPLY`) |
| `failed` | `Turn failed in <chat>` | Turn status `failed` |
| `stopped` | `Stopped in <chat>` | Turn status `cancelled` (human stop) |
| `automation_fired` | `Automation fired: <name> — in <chat>` | Turn whose trigger message is an automation delivery |
| `task_dispatched` | `Task dispatched: <title>` | Turn whose trigger message is a task dispatch |
| `new_session` | `Started fresh session` (+ ` — <reason>` when known: model switch, manual reset, full reset, idle) | Durable `new_session` notices |

Rules:

- One turn yields at most two entries: its arrival (`message_received`,
  `automation_fired`, or `task_dispatched`) and its outcome (`replied`,
  `declined`, `failed`, `stopped`). A still-running turn shows only its
  arrival entry — the live presence line, not the feed, says "working".
- `<chat>` is the chat title (fallback: chat id). `<sender>` is the trigger
  message author's display label. Cross-chat context is the point: entries
  without a place are not acceptable.
- Evaluation turns (default-evaluate fan-out) are `message_received`
  entries like any other; the feed does not distinguish addressed from
  evaluated.
- Entries are newest-first, timestamped with wall-clock times, default
  limit 20 (hover card shows the top 3–5).

## Surfaces

- **Agent profile, Activity tab** — the full timestamped diagnostics view
  with Copy Diagnostic Info ([agent-profile](agent-profile.md)). Read-only;
  entries are not links in v1.
- **Avatar hover card** — hovering any agent avatar (facepile, sidebar,
  transcript) shows the agent's name, live presence line, and the top few
  activity entries. Clicking a transcript avatar opens the profile in the
  chat's right pane; elsewhere it opens the Members profile page — the
  hover card is the preview, the profile is the full view.

## Contract

- Runtime owns the projection (`GET /agents/{id}/activity`), assembled
  from `agent_turns` (timestamps, status, anchor chat, trigger message)
  and durable session notices. Trigger provenance (automation, task)
  comes from the trigger message's runtime metadata.
- The read is on-demand and bounded; nothing is stored per entry. Without
  a reachable Runtime the feed is absent, like presence.
- Turn-grained only: tool calls, reasoning, and narration never appear in
  the feed — that detail belongs to the turn drawer. This is the same
  altitude line specs/chat-timeline.md draws for the timeline.

## Non-goals

- Live micro-states in the feed or presence label ("Running tools…") —
  the feed makes them unnecessary at this altitude.
- A durable activity table or activity event stream.
- Filtering, pagination, or per-chat activity views (revisit if the feed
  proves useful and 20 entries feel cramped).
