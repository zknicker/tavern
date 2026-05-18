---
summary: Realtime contract for durable chat events, volatile activity notifications, websocket recovery, cursors, ordering, and app stream boundaries.
read_when:
  - changing websocket subscriptions, event cursors, or reconnect behavior
  - adding a durable event type or volatile activity signal
  - changing chat activity, progress, or realtime recovery semantics
---

# Realtime

Realtime is notification plus recovery.

Runtime SQLite is the source of truth. WebSocket delivery is allowed to drop.
Clients recover through `GET /api/events?after_cursor=...`, websocket reconnect
with `after_cursor`, or durable resource reads.

## Components

| Component | Owner | Role |
| --- | --- | --- |
| `chat_events` | Tavern Runtime | Durable cursor-backed event log |
| `chat_activity` | Tavern Runtime | Latest active work state |
| Runtime event replay | Tavern Runtime | Reads derived from `chat_events` |
| App websocket | Tavern App | UI invalidation and client notifications |

App websocket events are not the durable event source. They can mirror Runtime
events, but missed app notifications recover through Tavern API reads.

Runtime event replay does not own a second event log. App notifications are
derived from durable `chat_events`.

## Endpoints

```http
GET /api/events?after_cursor=&recipient_id=&limit=
GET /api/events/ws?after_cursor=&recipient_id=
```

`GET /api/events` returns durable events with `cursor > after_cursor`, ordered
by cursor ascending. The server clamps `limit`.

`GET /api/events/ws` upgrades to a WebSocket. On connect, Runtime backfills
durable events newer than `after_cursor`, then streams live notifications until
disconnect.

Private events are delivered only when `recipient_id` matches an event
recipient. Without a matching `recipient_id`, replay and websocket delivery
include public events only.

## Event Shape

```jsonc
{
  "id": "evt_...",
  "cursor": "101",
  "type": "message.created",
  "chat_id": "cht_...",
  "created_at": "2026-05-17T00:00:00.000Z",
  "private": false,
  "recipients": [],
  "message": {}
}
```

Events carry stable identity and enough cursor data to reconcile or refetch.
Large records live in resource reads, not event payloads.

## Durable Events

Durable events are inserted in the same Runtime transaction as the mutation they
describe.

Chat events:

* `message.created`
* `message.delivered`
* `message.updated`
* `message.deleted`
* `chat.read`
* `chat.activity.updated`
* `chat.activity.completed`
* `chat.activity.failed`

Automation, memory, knowledgebase, skill, and stats events use the same durable
event log when they affect client-visible Runtime state.

Read events are private to the reader. Private events use `private` plus
`recipients`, and Runtime filters them during replay and websocket delivery.

## Ephemeral Notifications

Ephemeral notifications are best-effort presentation hints. They can be dropped
under load and are not replayed after disconnect.

Examples:

* transient typing or thinking indicators
* short-lived hover/debug state
* app-only invalidation hints

Tool progress, assistant draft text, and provider-exposed reasoning summaries
are not pure ephemeral notifications in Tavern chat. Runtime writes their latest
active state to `chat_activity` and emits `chat.activity.*` events.

## Cursor Recovery

Clients keep the latest applied `cursor`.

Reconnect flow:

1. Connect to `GET /api/events/ws?after_cursor=<cursor>&recipient_id=<id>`.
2. Apply backfilled durable events in cursor order.
3. Stream live notifications.
4. On disconnect, keep the latest applied cursor.
5. If the replay window is insufficient, refetch durable resources such as chat
   history and current activity.

History recovery does not depend on the event log retaining full message
payloads. If a client sees a cursor gap, it refetches the affected resource.

## Ordering

* `chat_events.cursor` is monotonic inside Runtime SQLite.
* Message timeline order is `chat_messages.sequence`, not event cursor.
* Event cursor order tells clients what changed.
* Sequence order tells clients how to render chat history.
* Final reconciliation upserts by stable ids.

## App Stream Boundary

Tavern App can expose its own websocket or tRPC subscriptions for UI
invalidation. Those subscriptions are app notifications.

Product state still comes from:

* `GET /api/chats/{chat_id}/messages`
* `GET /api/events?after_cursor=...`
* current `chat_activity`
* focused resource reads for automations, memory, knowledgebase, skills, and
  stats

## What Is Intentionally Missing

* WebSocket-only durable state.
* Message history stored only in event payloads.
* Activity rows created from app-local UI state.
* Hidden chain-of-thought in realtime events.
* Runtime session sequence as an event cursor.

## Related Docs

* [API overview](overview.md)
* [Chat API](chat.md)
* [Data model](../internals/data-model.md)
