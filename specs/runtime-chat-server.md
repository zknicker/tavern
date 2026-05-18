# Tavern Runtime Chat Server

Tavern Runtime is the always-on chat server.

The Mac app can close. Agents, automations, deliveries, and event history keep
running. When the app reconnects, it reads runtime chat history and event
cursors instead of reconstructing the product timeline from OpenClaw transcripts.

## Problem

Tavern started as a local app projection over managed OpenClaw. That shape is
not enough for always-on agent work:

* Automations need to create messages while the app is closed.
* Agents need to post replies into chats while the app is closed.
* Reconnect recovers from Tavern chat history, not from fuzzy OpenClaw
  transcript projection.
* Websocket delivery can drop, but missed state must remain recoverable.

## Decision

Tavern Runtime owns canonical chat state:

* chats
* participants
* messages
* message parts
* events
* reads
* deliveries
* activity
* automations and automation runs

Tavern App is the first-party client. It may cache data and keep presentation
state, but it is not the durable chat server.

OpenClaw is the execution engine. It owns sessions, turns, tools, model calls,
files, and native transcripts. Those records are execution evidence linked to
Tavern messages, not the product timeline.

## Tables

Runtime SQLite owns:

```text
chats
chat_participants
chat_messages
chat_message_parts
chat_events
chat_reads
chat_deliveries
chat_activity
runtime_sessions
runtime_turns
runtime_transcript_messages
runtime_tool_calls
runtime_artifacts
automations
automation_runs
```

Memory, knowledgebase, and search are runtime-owned product surfaces. Their
table details live with those feature contracts.

## App Cache And Evidence

App tables are cache, settings, or runtime evidence:

| Current table | Runtime role |
| --- | --- |
| `chats` | app cache of runtime `chats` |
| `session_runs` | `runtime_sessions` / `runtime_turns` evidence |
| `session_messages` | `runtime_transcript_messages` evidence |
| `session_message_parts` | `runtime_transcript_messages` or `runtime_artifacts` evidence |
| `session_tool_calls` | `runtime_tool_calls` |
| `session_artifacts` | `runtime_artifacts` |
| `cron_jobs` | `automations` |
| `cron_runs` | `automation_runs` |

## Invariants

* Message creation is durable first.
* Per-chat `sequence` is assigned in the same transaction as message insert.
* Durable events are inserted in the same transaction as the mutation.
* Duplicate `message.id` or `(chat_id, nonce)` returns the existing message.
* Plugin relay delivery is queued after the durable message exists.
* Assistant replies are Tavern messages authored by agent participants.
* OpenClaw transcript rows link to Tavern messages and never replace them.
* Soft deletes preserve sequence slots.
* Activity is volatile and must not become a second chat history.
* Reconnect recovers by runtime history and event cursor.
* Content/timestamp duplicate detection is not allowed.

## API Shape

The Tavern API is OpenAPI-defined and runtime-hosted.

Chat operations:

```text
GET /api/activity
POST /api/chats
GET /api/chats
GET /api/chats/{chat_id}
GET /api/chats/{chat_id}/messages?after_sequence=&limit=
POST /api/chats/{chat_id}/messages
POST /api/chats/{chat_id}/deliveries
POST /api/chats/{chat_id}/activity
POST /api/chats/{chat_id}/read
DELETE /api/messages/{message_id}
GET /api/events?after_cursor=
GET /api/events/ws
```

OpenAPI lives in `packages/tavern-api/openapi.yaml`. Runtime handlers return
that shape. `@tavern/sdk` wraps it for the app, automations, webhooks, managed
OpenClaw, and tests.

## Test Gates

* Duplicate sends with the same id or nonce return the same message receipt.
* Hard reload recovers one user message and one assistant reply from runtime
  chat history.
* Websocket drop/reconnect recovers by event cursor and history read.
* Final OpenClaw transcript sync cannot create a second user row.
* Automations can append chat messages while the app is closed.
* Tool progress and reasoning summaries render as activity before final reply.
* Soft delete preserves message sequence.

## References

* [Data model](../docs/internals/data-model.md)
* [Architecture overview](../docs/internals/architecture-overview.md)
* [Chat API](../docs/api/chat.md)
* [Realtime](../docs/api/realtime.md)
* [Tavern Runtime](../docs/internals/runtime.md)
