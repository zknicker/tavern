---
read_when:
  - changing SQLite tables, ids, projection invariants, or runtime transcript storage
  - changing chat/session/message identity, event recovery, or sync semantics
---

# Data Model

Tavern Runtime is the always-on chat server.

OpenClaw is an agent runtime participating in Tavern chats. It owns sessions,
turns, tools, model calls, files, and native transcripts. Tavern Runtime owns
chats, messages, participants, sequence, events, reads, soft deletes,
automations, deliveries, activity, and the product timeline.

## Source Files

| Layer | Source | Role |
| --- | --- | --- |
| Runtime schema | `apps/runtime/src/db/schema.ts` | Runtime SQLite schema and fresh setup |
| Runtime chat store | `apps/runtime/src/tavern/chat-api/` | OpenAPI-backed chat, message, delivery, activity, read, and event store |
| Runtime channel outbox | `apps/runtime/src/tavern/channel-store.ts` | Tavern Messenger plugin ingress queue and accepted-message receipt state |
| Runtime chat tests | `apps/runtime/src/tavern/chat-api-store.test.ts` | Contract, identity, sequence, event, read, and route behavior |
| App schema | `apps/server/src/db/bootstrap.ts` | App SQLite fresh setup |
| App Drizzle schema | `apps/server/src/db/schema/` | Typed app cache/projection tables |
| Tavern API package | `packages/tavern-api/src/` | OpenAPI-generated and Zod-backed API contracts |
| OpenClaw state | Managed OpenClaw store | Native execution and transcripts |

## Store Boundaries

| Store | Owner | Contents |
| --- | --- | --- |
| Runtime SQLite | Tavern Runtime | Canonical chat model, automation delivery, channel ingress, cursor-backed events, read markers, runtime metadata |
| App SQLite | Tavern App | Client cache, app-local settings, presentation state, and runtime evidence views |
| OpenClaw state | OpenClaw | Sessions, turns, tools, model calls, transcripts, and files |

Runtime SQLite is the product source of truth for chat. App SQLite can cache for
fast UI, but reconnect and hard reload recover from Runtime history and cursors.
OpenClaw transcripts are execution evidence linked to Tavern messages.

The Tavern Messenger plugin has a small Runtime outbox. It stores only relay
state: request id, durable message id, route, cursor, and plugin acceptance. It
does not store message content, nonce, sequence, participants, or duplicate
history.

## IDs

Use semantic prefixes at the Tavern API boundary.

| Prefix | Entity |
| --- | --- |
| `cht_` | chat |
| `msg_` | message |
| `part_` | message part |
| `usr_` | user participant |
| `agt_` | agent participant |
| `sys_` | system participant |
| `evt_` | event |
| `del_` | delivery |
| `run_` | Tavern-visible run |
| `rt_` | runtime connection |

Activity and read markers are scoped records, not standalone product ids.
OpenClaw ids and runtime agent ids remain source ids. Store them in runtime
metadata or projection fields, not as Tavern product ids unless Tavern minted
them.

## Runtime Chat Tables

```text
chats
chat_participants
chat_messages
chat_message_parts
chat_events
chat_reads
chat_deliveries
chat_activity
```

These tables live in Runtime SQLite and back the OpenAPI chat contract.

`tavern_channel_outbox` also lives in Runtime SQLite, but it is not chat
history. It is the private relay queue for the managed Tavern Messenger plugin
and hydrates frames from `chat_messages`.

## `chats`

Durable conversation containers.

```text
chats
  id                    TEXT PRIMARY KEY
  kind                  TEXT NOT NULL        -- channel, dm, thread
  title                 TEXT
  status                TEXT NOT NULL        -- active, archived
  created_by            TEXT
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL
  archived_at           TEXT
```

Indexes:

```text
idx_chats_updated_at(updated_at)
idx_chats_status_updated_at(status, updated_at)
```

## `chat_participants`

Actors that can author messages or receive private events.

```text
chat_participants
  id                    TEXT PRIMARY KEY
  chat_id               TEXT NOT NULL
  kind                  TEXT NOT NULL        -- user, agent, system, external
  source                TEXT NOT NULL        -- tavern, openclaw, discord, system
  source_id             TEXT
  profile_id            TEXT
  agent_id              TEXT
  observed_label        TEXT
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  joined_at             TEXT NOT NULL
  last_seen_at          TEXT
```

Indexes:

```text
idx_chat_participants_chat(chat_id)
idx_chat_participants_source(source, source_id)
idx_chat_participants_profile(profile_id)
idx_chat_participants_agent(agent_id)
```

Do not merge participants by display name. Profile linking is Tavern-owned
state.

## `chat_messages`

Durable chat rows ordered by per-chat sequence.

```text
chat_messages
  id                    TEXT PRIMARY KEY
  chat_id               TEXT NOT NULL
  sequence              INTEGER NOT NULL
  author_participant_id TEXT NOT NULL
  status                TEXT NOT NULL        -- accepted, delivered, failed, deleted
  nonce                 TEXT
  source                TEXT NOT NULL        -- tavern, openclaw, automation, system
  request_id            TEXT
  delivery_id           TEXT
  run_id                TEXT
  session_key           TEXT
  session_id            TEXT
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL
  deleted_at            TEXT
```

Indexes and uniqueness:

```text
UNIQUE(chat_id, sequence)
UNIQUE(chat_id, nonce) WHERE nonce IS NOT NULL
idx_chat_messages_chat_sequence(chat_id, sequence)
idx_chat_messages_author(author_participant_id)
idx_chat_messages_delivery(delivery_id)
idx_chat_messages_run(run_id)
idx_chat_messages_session(session_key)
```

Rules:

* Message creation is durable before model work starts.
* Sequence is assigned in the message insert transaction.
* Duplicate `message.id` returns the existing message.
* Duplicate `(chat_id, nonce)` returns the existing message.
* Content, timestamp, and display text are never duplicate keys.
* Soft delete updates `status` and `deleted_at`; it keeps the row and sequence.

## `chat_message_parts`

Ordered content inside a message.

```text
chat_message_parts
  id                    TEXT PRIMARY KEY
  message_id            TEXT NOT NULL
  part_index            INTEGER NOT NULL
  type                  TEXT NOT NULL        -- text, reasoning_summary, file, image, tool_ref, json
  text                  TEXT
  asset_id              TEXT
  tool_call_id          TEXT
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
```

Indexes and uniqueness:

```text
UNIQUE(message_id, part_index)
idx_chat_message_parts_message(message_id)
idx_chat_message_parts_tool_call(tool_call_id)
```

Hidden chain-of-thought is not a message part. Provider-exposed reasoning
summaries can be a `reasoning_summary` part or activity summary.

## `chat_events`

Recoverable notifications inserted with the mutation they describe.

```text
chat_events
  id                    TEXT PRIMARY KEY
  cursor                INTEGER NOT NULL
  type                  TEXT NOT NULL
  actor_participant_id  TEXT
  chat_id               TEXT
  message_id            TEXT
  delivery_id           TEXT
  activity_id           TEXT
  sequence              INTEGER
  is_private            INTEGER NOT NULL DEFAULT 0
  payload_json          TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
```

Indexes and uniqueness:

```text
UNIQUE(cursor)
idx_chat_events_chat_cursor(chat_id, cursor)
idx_chat_events_message(message_id)
idx_chat_events_delivery(delivery_id)
idx_chat_events_activity(activity_id)
idx_chat_events_type_cursor(type, cursor)
```

Rules:

* Insert durable events in the same transaction as the mutation.
* Cursor is monotonic inside Runtime SQLite.
* Websocket delivery is best-effort.
* Clients recover by asking for events after a cursor or by reading the durable
  resource.
* Large state lives in tables, not event payloads.

## `chat_reads`

Per-reader read pointers.

```text
chat_reads
  chat_id               TEXT NOT NULL
  reader_participant_id TEXT NOT NULL
  last_read_sequence    INTEGER NOT NULL
  read_at               TEXT NOT NULL
```

Indexes and uniqueness:

```text
PRIMARY KEY(chat_id, reader_participant_id)
idx_chat_reads_reader(reader_participant_id)
```

Rules:

* Reads are monotonic per `(chat_id, reader_participant_id)`.
* The server caps `last_read_sequence` to the chat's current last sequence.
* Read events are private to the reader.

## `chat_deliveries`

Assistant delivery receipts.

```text
chat_deliveries
  id                    TEXT PRIMARY KEY
  chat_id               TEXT NOT NULL
  request_message_id    TEXT
  message_id            TEXT
  author_participant_id TEXT NOT NULL
  status                TEXT NOT NULL        -- delivered, suppressed, failed
  run_id                TEXT
  session_key           TEXT
  session_id            TEXT
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  delivered_at          TEXT
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL
```

Indexes:

```text
idx_chat_deliveries_chat(chat_id)
idx_chat_deliveries_request_message(request_message_id)
idx_chat_deliveries_message(message_id)
idx_chat_deliveries_run(run_id)
idx_chat_deliveries_session(session_key)
```

Duplicate `delivery.id` returns the existing delivery receipt. Duplicate
assistant `message.id` links the delivery to the existing durable message
instead of creating another message row.

## `chat_activity`

Latest active work state for a chat, message, delivery, or run.

```text
chat_activity
  chat_id               TEXT PRIMARY KEY
  run_id                TEXT
  agent_id              TEXT NOT NULL
  status                TEXT NOT NULL        -- queued, running, completed, failed
  summary               TEXT
  steps_json            TEXT NOT NULL DEFAULT '[]'
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  updated_at            TEXT NOT NULL
```

Indexes:

```text
PRIMARY KEY(chat_id)
```

Rules:

* Activity is not chat history.
* Runtime stores latest active state in `chat_activity`.
* Runtime emits `chat.activity.*` events as notifications.
* Completion closes activity without creating message rows.
* Hidden chain-of-thought is never stored here.

## Runtime Execution Evidence

OpenClaw execution links to Tavern messages.

```text
runtime_sessions
  session_key           TEXT PRIMARY KEY
  session_id            TEXT
  chat_id               TEXT NOT NULL
  agent_id              TEXT NOT NULL
  status                TEXT
  started_at            TEXT
  updated_at            TEXT NOT NULL

runtime_turns
  id                    TEXT PRIMARY KEY
  chat_id               TEXT NOT NULL
  request_message_id    TEXT
  response_message_id   TEXT
  agent_id              TEXT NOT NULL
  session_key           TEXT NOT NULL
  openclaw_run_id       TEXT
  status                TEXT NOT NULL
  started_at            TEXT
  finished_at           TEXT

runtime_transcript_messages
  id                    TEXT PRIMARY KEY
  chat_id               TEXT
  message_id            TEXT
  session_key           TEXT NOT NULL
  session_id            TEXT
  openclaw_message_id   TEXT
  seq                   INTEGER
  role                  TEXT NOT NULL
  content_text          TEXT
  raw_json              TEXT NOT NULL
  synced_at             TEXT NOT NULL

runtime_tool_calls
  id                    TEXT PRIMARY KEY
  chat_id               TEXT
  message_id            TEXT
  session_key           TEXT NOT NULL
  run_id                TEXT
  tool_call_id          TEXT
  tool_name             TEXT NOT NULL
  status                TEXT
  raw_json              TEXT NOT NULL
  updated_at            TEXT NOT NULL
```

OpenClaw transcript messages, tool calls, links, and artifacts are runtime
evidence. They enrich the UI, but they do not replace canonical chat history.

## Transaction Rules

Message create:

1. Open `BEGIN IMMEDIATE`.
2. Resolve duplicate `message.id` or `(chat_id, nonce)`.
3. Assign `sequence = MAX(sequence) + 1` for the chat.
4. Insert `chat_messages`.
5. Insert ordered `chat_message_parts`.
6. Insert `chat_events(message.created)` with the same sequence.
7. Commit.

Assistant delivery:

1. Open `BEGIN IMMEDIATE`.
2. Resolve duplicate `delivery.id`.
3. Insert `chat_deliveries`.
4. Create or link the assistant `chat_messages` row when final text exists.
5. Insert `chat_events(message.delivered)`.
6. Commit.

Activity update:

1. Open `BEGIN IMMEDIATE`.
2. Upsert `chat_activity`.
3. Insert `chat_events(chat.activity.updated|completed|failed)`.
4. Commit.

Read update:

1. Open `BEGIN IMMEDIATE`.
2. Cap the requested sequence to the chat's last sequence.
3. Upsert `chat_reads` only when the new sequence is greater.
4. Insert private `chat_events(chat.read)`.
5. Commit.

## App Cache And Evidence

App tables are cache, settings, or execution evidence:

| Current table | Runtime role |
| --- | --- |
| `chats` | app cache of Runtime `chats` |
| `session_runs` | `runtime_sessions` and `runtime_turns` evidence |
| `session_messages` | `runtime_transcript_messages` evidence |
| `session_message_parts` | `runtime_transcript_messages` or runtime artifacts evidence |
| `session_tool_calls` | `runtime_tool_calls` |
| `session_artifacts` | runtime artifacts |
| `session_deliveries` | `chat_deliveries` or runtime delivery evidence |
| `cron_jobs` | `automations` |
| `cron_runs` | `automation_runs` |

## FTS

Search has first-class indexing for:

* chat messages
* knowledgebase pages and files
* memory records

SQLite FTS mirrors durable text fields through triggers or explicit
transactional writes. Search indexes are derived state, not the source of truth.

## Invariants

* Tavern Runtime chat history is canonical product state.
* OpenClaw transcript history is runtime-owned evidence.
* Runtime adapters preserve source ids and metadata without authoring final
  Tavern presentation.
* Reconciliation uses ids, nonces, sequences, delivery ids, session keys, and
  run ids.
* Reconciliation never uses content/timestamp duplicate detection.
* Events notify; runtime durable reads recover.
* Volatile activity never becomes a second chat history.

## Related Docs

* [API overview](../api/overview.md)
* [Chat API](../api/chat.md)
* [Realtime](../api/realtime.md)
* [Tavern Runtime](runtime.md)
* [Architecture overview](architecture-overview.md)
* [Tavern Runtime Chat Server](../../specs/runtime-chat-server.md)
