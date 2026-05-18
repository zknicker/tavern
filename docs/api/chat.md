---
summary: Durable chat API for messages, per-chat sequence, receipts, deliveries, activity, reads, events, soft deletes, and OpenClaw metadata.
read_when:
  - changing chat messages, receipts, live activity, history, or timeline recovery
  - changing how OpenClaw, bots, webhooks, or local tools send chat work into Tavern
---

# Chat API

The Chat API is message-first and runtime-hosted.

Agent runtimes have sessions and turns. Chat apps have messages. Tavern Runtime
exposes durable messages, volatile activity, receipts, history, and events.
Execution identity rides along as metadata.

## Source Of Truth

Tavern Runtime is the durable source for chat objects.

| Object | Durability | Store |
| --- | --- | --- |
| `chat` | Durable | Runtime SQLite |
| `message` | Durable | Runtime SQLite |
| `message_part` | Durable | Runtime SQLite |
| `delivery` | Durable receipt | Runtime SQLite |
| `activity` | Volatile, recoverable while active | Runtime SQLite `chat_activity` |
| `event` | Recoverable notification | Runtime SQLite |

App SQLite is a cache and presentation store. OpenClaw transcripts are execution
evidence linked to Tavern messages.

## Endpoints

```http
GET    /api/activity
GET    /api/chats?cursor=&limit=
POST   /api/chats
GET    /api/chats/{chat_id}
GET    /api/chats/{chat_id}/messages?after_sequence=&before_sequence=&limit=
POST   /api/chats/{chat_id}/messages
POST   /api/chats/{chat_id}/deliveries
POST   /api/chats/{chat_id}/activity
POST   /api/chats/{chat_id}/read
GET    /api/messages/{message_id}
DELETE /api/messages/{message_id}
GET    /api/events?after_cursor=&limit=
GET    /api/events/ws?after_cursor=
```

The transport can be local HTTP, tRPC wrapping, or a TypeScript SDK method. The
contract stays the same.

## Messages

`POST /api/chats/{chat_id}/messages` creates a durable user, assistant, or
system message before work starts.

Request:

```jsonc
{
  "id": "msg_...",
  "nonce": "client-send-...",
  "author_id": "usr_...",
  "role": "user",
  "parts": [
    { "kind": "text", "content": "Run the report." }
  ],
  "metadata": {
    "runtime": {
      "source": "openclaw",
      "agentId": "main",
      "sessionKey": "agent:main:tavern:channel:..."
    }
  }
}
```

Response:

```jsonc
{
  "cursor": "94",
  "idempotent": false,
  "message": {
    "id": "msg_...",
    "chat_id": "cht_...",
    "sequence": 12,
    "author": {
      "id": "usr_...",
      "kind": "user",
      "label": null,
      "metadata": {}
    },
    "role": "user",
    "parts": [
      { "id": "part_...", "kind": "text", "content": "Run the report.", "metadata": {} }
    ],
    "nonce": "client-send-...",
    "delivery_id": null,
    "parent_message_id": null,
    "thread_root_id": null,
    "deleted_at": null,
    "created_at": "2026-05-17T00:00:00.000Z",
    "metadata": {}
  }
}
```

Duplicate creates are idempotent:

* Same `message.id` returns the existing message and receipt.
* Same `(chat_id, nonce)` returns the existing message and receipt.
* Same logical message never creates a second durable row.
* Content, timestamp, and display text are never duplicate keys.

## History

`GET /api/chats/{chat_id}/messages` returns durable messages ordered by
per-chat `sequence`.

Rules:

* `after_sequence` and `before_sequence` are exclusive cursor windows.
* `limit` is clamped by the server.
* Soft-deleted messages keep their sequence slot.
* Message parts are hydrated in display order.
* Authors are hydrated enough for clients to render without a second lookup.

Runtime sessions can have their own sequence domains. Preserve runtime sequence
in metadata or projection fields; never use it as the Tavern timeline cursor.

## Deliveries

`POST /api/chats/{chat_id}/deliveries` records an assistant delivery receipt and,
when text is final, creates or links the assistant message.

Request:

```jsonc
{
  "id": "del_...",
  "agent_id": "agt_...",
  "turn_id": "run_...",
  "message": {
    "id": "msg_assistant_...",
    "author_id": "agt_...",
    "role": "assistant",
    "parts": [
      { "kind": "text", "content": "Done." }
    ],
    "metadata": {}
  },
  "metadata": {
    "runtime": {
      "source": "openclaw",
      "agentId": "main",
      "sessionKey": "agent:main:tavern:channel:...",
      "sessionId": "...",
      "runId": "run_..."
    }
  }
}
```

Response:

```jsonc
{
  "id": "del_...",
  "message": { "id": "msg_assistant_..." },
  "cursor": "101",
  "idempotent": false
}
```

Duplicate `delivery.id` returns the existing delivery receipt. Duplicate
assistant `message.id` links the delivery to the existing durable message
instead of creating a second row.

## Activity

`GET /api/activity` lists current live activity for chats with active or recent
work.

`POST /api/chats/{chat_id}/activity` updates live work state for an active
message, delivery, or run.

Activity can include:

* working, thinking, using-tool, completed, and failed status
* draft assistant text
* provider-exposed reasoning summaries
* tool or command steps
* progress labels and timing

Activity is not chat history. It can be dropped after completion. Reload
recovery reads durable messages, durable events, and current active status.
Runtime stores the latest active state in `chat_activity` and emits
`chat.activity.*` events as notifications. Events replay that an activity
changed; `chat_activity` is the read model clients use after reload.

Hidden chain-of-thought is not part of the API. Reasoning text is allowed only
when the runtime exposes a user-visible summary.

## Reads

`POST /api/chats/{chat_id}/read` accepts
`{ "reader_id": "usr_...", "last_read_sequence": 12 }` and advances the
reader's monotonic read pointer for that chat.

Read events are private to the reader. Event replay and websocket delivery
include them only when `recipient_id` matches `reader_id`.

## Events

Message create, delivery, update, delete, activity, and read mutations emit
recoverable events.

Durable events are inserted in the same transaction as the mutation they
describe:

* `message.created`
* `message.delivered`
* `message.updated`
* `message.deleted`
* `chat.read`
* `chat.activity.updated`
* `chat.activity.completed`
* `chat.activity.failed`

Event shape:

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

Websocket delivery is a notification pipe. Clients recover missed state through
`GET /api/events?after_cursor=...` or durable chat reads.

## Deletes

`DELETE /api/messages/{message_id}` soft-deletes a message.

Soft delete sets `deleted_at`, keeps the row, and preserves the per-chat sequence
slot so cursors remain stable. Hard delete is not part of the Chat API.

## OpenClaw Metadata

OpenClaw identity stays in metadata:

```text
runtime.source
runtime.agentId
runtime.sessionKey
runtime.sessionId
runtime.runId
runtime.deliveryId
runtime.transcriptMessageId
```

OpenClaw transcript sync upserts by stable Tavern ids when they are present.
Transcript rows without Tavern identity remain execution evidence; they are not
matched to existing Tavern messages by content or timestamp.

## What Is Intentionally Missing

* Hard delete.
* Content/timestamp duplicate detection.
* Hidden chain-of-thought as message content or activity.
* Runtime session sequence as the Tavern timeline cursor.
* OpenClaw transcript rows as canonical chat history.

## Related Docs

* [Realtime](realtime.md)
* [Data model](../internals/data-model.md)
* [Chat feature](../features/chat.md)
* [Tavern Runtime Chat Server](../../specs/runtime-chat-server.md)
* [Tavern OpenClaw Messenger Plugin](../internals/tavern-openclaw-messenger-plugin.md)
