---
summary: Durable chat API for messages, responses, activity, artifacts, receipts, reads, events, soft deletes, and OpenClaw metadata.
read_when:
  - changing chat messages, responses, activity, artifacts, receipts, history, or timeline recovery
  - changing how OpenClaw, bots, webhooks, or local tools send chat work into Tavern
---

# Chat API

The Chat API is message-first and runtime-hosted.

Agent runtimes have sessions and turns. Chat apps have messages and responses.
Tavern Runtime exposes durable messages, agent responses, response activity,
artifacts, receipts, history, and events. Execution identity rides along as
metadata.

## Source Of Truth

Tavern Runtime is the durable source for chat objects.

| Object | Durability | Store |
| --- | --- | --- |
| `chat` | Durable | Runtime SQLite |
| `message` | Durable | Runtime SQLite |
| `response` | Durable | Runtime SQLite |
| `activity` | Durable response work | Runtime SQLite |
| `artifact` | Durable renderable output | Runtime SQLite or content store |
| `delivery` | Durable receipt | Runtime SQLite |
| `event` | Recoverable notification | Runtime SQLite |

App SQLite is a cache and presentation store. OpenClaw transcripts are execution
evidence linked to Tavern messages.

## Endpoints

```http
GET    /api/chats?cursor=&limit=
POST   /api/chats
GET    /api/chats/{chat_id}
GET    /api/chats/{chat_id}/messages?after_sequence=&before_sequence=&limit=
GET    /api/chats/{chat_id}/responses?after_sequence=&limit=
GET    /api/chats/{chat_id}/activity/{activity_id}
POST   /api/chats/{chat_id}/messages
POST   /api/chats/{chat_id}/deliveries
POST   /api/chats/{chat_id}/responses
POST   /api/chats/{chat_id}/responses/{response_id}/activity
POST   /api/chats/{chat_id}/artifacts
POST   /api/chats/{chat_id}/read
GET    /api/messages/{message_id}
DELETE /api/messages/{message_id}
GET    /api/events?limit=
GET    /api/events/ws
```

The transport can be local HTTP, tRPC wrapping, or a TypeScript SDK method. The
contract stays the same.

## Tavern App Reads

The Tavern app keeps list and detail reads separate:

* `chat.list` returns ordered Tavern chat ids plus lightweight list items. It is
  the sidebar and overview contract, not a full chat detail payload. List items
  include `hasActiveTurn` so compact views can show in-progress agent work
  without reading the full chat log. External OpenClaw chat references belong to
  `agent.chats.list`, not the global Tavern chat list.
* `chat.get` returns one full chat record by `chatId`.
* `chat.log.list` returns paged durable timeline rows for one chat, including
  messages, responses, running and completed activity, and renderable artifacts.

Invalidate `chat.list` when membership or list ordering can change. Invalidate
`chat.get` when one chat's detail fields can change. Response and activity
events update the app timeline by stable ids. Durable log invalidation belongs
when messages, responses, activity, or artifacts are persisted.

Live turn progress updates the visible `chat.log.list` cache by activity id.
The eventual durable read returns the same row ids, so running activity becomes
completed activity without remounting the transcript. Streamed final reply text
stays app-local until the final assistant message is persisted.

## Messages

`POST /api/chats/{chat_id}/messages` creates a durable user, assistant, or
system message before work starts.

Messages have one text body and an optional durable attachment. Agent work such
as reasoning summaries, tool calls, tool results, preambles, and progress belongs
to `response` and `activity` records, not message body fields.

Request:

```jsonc
{
  "id": "msg_...",
  "nonce": "client-send-...",
  "author_id": "usr_...",
  "role": "user",
  "content": "Run the report.",
  "attachment": null,
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
    "content": "Run the report.",
    "attachment": null,
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
* Message `content` and optional `attachment` are hydrated with the row.
* Authors are hydrated enough for clients to render without a second lookup.

Runtime sessions can have their own sequence domains. Preserve runtime sequence
in metadata or source fields; never use it as the Tavern timeline cursor.

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
    "content": "Done.",
    "attachment": null,
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

Activity is durable work performed as part of a response.

A response is one participant's attempt to answer or act on a chat message. Most
responses are authored by agents, but the Tavern noun stays chat-first:
OpenClaw turns, runs, and transcript ids are runtime metadata on the response,
not the product identity.

Activity can include:

* planning and reasoning summaries
* tool calls and tool results
* commands
* approvals
* code snippets
* image, file, diff, or document outputs
* final assistant message references

Activities are ordered inside their response and carry status:
`queued`, `running`, `completed`, `failed`, or `cancelled`. Runtime upserts
activity rows while work is happening, then marks the same rows complete or
failed when results arrive. Reload recovery reads the same durable activity rows
for running and completed responses.

Common activity kinds:

| Kind | Use |
| --- | --- |
| `planning` | Current plan or task list. |
| `reasoning` | Provider-exposed reasoning summary. |
| `message` | Assistant preamble or structured progress text before the final message. |
| `tool_call` | Runtime tool work with stable tool identity. |
| `tool_result` | Tool result material when it is represented separately. |
| `command` | Shell-like command work when the runtime exposes it as a command. |
| `approval` | User or system approval request and decision. |
| `artifact` | Renderable output, patch, file, image, document, or diff summary. |
| `custom` | Runtime-specific activity with typed metadata. |

Clients open activity detail surfaces by stable activity id:
`GET /api/chats/{chat_id}/activity/{activity_id}`. The returned row is the same
durable activity used by timeline rendering, including runtime tool metadata and
artifact links.

Activity ids are global Tavern ids. Updating an activity id that belongs to a
different chat or response is a contract error. Runtime adapters must include
turn identity when their source item ids can repeat across turns.

```jsonc
{
  "id": "act_...",
  "response_id": "rsp_...",
  "kind": "tool_call",
  "status": "completed",
  "title": "bash",
  "detail": "sed -n '1,220p' docs/api/chat.md",
  "artifact_ids": ["art_..."],
  "metadata": {
    "runtime": {
      "source": "openclaw",
      "sessionKey": "agent:main:tavern:channel:...",
      "turnId": "...",
      "toolCallId": "call_...",
      "toolName": "bash"
    }
  }
}
```

## Artifacts

Artifacts are durable renderable outputs produced by messages or response
activity.

Examples:

* code blocks and command output
* screenshots and generated images
* files and file previews
* diffs
* documents, spreadsheets, and charts

Artifacts are not tool calls by themselves. Tool-call activity may reference one
or more artifacts when it produces renderable output.

Hidden chain-of-thought is not part of the API. Reasoning text is allowed only
when the runtime exposes a user-visible summary.

## Reads

`POST /api/chats/{chat_id}/read` accepts
`{ "reader_id": "usr_...", "last_read_sequence": 12 }` and advances the
reader's monotonic read pointer for that chat.

Read events are private to the reader. Event list and websocket delivery
include them only when `recipient_id` matches `reader_id`.

## Events

Message, response, activity, artifact, delivery, update, delete, and read
mutations emit recoverable events.

Durable events are inserted in the same transaction as the mutation they
describe:

* `message.created`
* `message.delivered`
* `message.updated`
* `message.deleted`
* `response.created`
* `response.updated`
* `response.completed`
* `response.failed`
* `activity.created`
* `activity.updated`
* `activity.completed`
* `activity.failed`
* `artifact.created`
* `chat.read`

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
durable chat reads.

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
runtime.turnId
runtime.deliveryId
runtime.transcriptMessageId
runtime.toolCallId
runtime.toolName
```

OpenClaw transcript sync upserts by stable Tavern ids when they are present.
Transcript rows without Tavern identity remain execution evidence. Tavern links
them through response and activity metadata when possible; they are not matched
to existing Tavern messages by content or timestamp.

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
