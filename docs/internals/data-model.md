---
summary: Tavern data model for Runtime chat tables, responses, activity, artifacts, semantic ids, transactions, execution evidence, app cache, FTS, and invariants.
read_when:
  - changing SQLite tables, ids, sync invariants, or runtime transcript storage
  - changing chat/session/message identity, event recovery, or sync semantics
---

# Data Model

Tavern Runtime is the always-on chat server.

Hermes is an agent runtime participating in Tavern chats. It owns sessions,
turns, tools, model calls, files, and native transcripts. Tavern Runtime owns
chats, messages, responses, activity, artifacts, participants, sequence, events,
reads, soft deletes, automations, deliveries, and the product timeline.

## Source Files

| Layer | Source | Role |
| --- | --- | --- |
| Runtime schema | `apps/runtime/src/db/schema.ts` | Runtime SQLite schema and fresh setup |
| Runtime chat store | `apps/runtime/src/tavern/chat-api/` | OpenAPI-backed chat, message, response, activity, artifact, delivery, read, and event store |
| Runtime channel relay | `apps/runtime/src/tavern/channel-relay.ts` | Durable message acceptance and managed Hermes turn startup |
| Runtime channel outbox | `apps/runtime/src/tavern/channel-store.ts` | Private relay queue and accepted-message receipt state for channel-style ingress |
| Cortex wiki store | `apps/runtime/src/wiki/` | Runtime read API over the Cortex wiki hub |
| Runtime chat tests | `apps/runtime/src/tavern/chat-api-store.test.ts` | Contract, identity, sequence, event, read, and route behavior |
| Runtime timeline tests | `apps/runtime/src/tavern/chat-api-timeline.test.ts` | Turn-aligned history pages, cursor stability, and window alignment |
| App schema | `apps/server/src/db/bootstrap.ts` | App SQLite fresh setup |
| App Drizzle schema | `apps/server/src/db/schema/` | Typed app cache and synced runtime tables |
| Tavern API package | `packages/tavern-api/src/` | OpenAPI-generated and Zod-backed API contracts |
| Hermes state | Managed Hermes store | Native execution and transcripts |

## Store Boundaries

| Store | Owner | Contents |
| --- | --- | --- |
| Runtime SQLite | Tavern Runtime | Canonical chat model, automation delivery, channel ingress, cursor-backed events, read markers, runtime metadata |
| App SQLite | Tavern App | Client cache, app-local settings, and presentation state |
| Cortex wiki hub | Managed `cortex-wiki` skill and agent jobs | Topic Markdown, raw sources, compiled pages, todos, datasets, output, inbox, archives |
| Hermes state | Hermes | Sessions, turns, tools, model calls, transcripts, and files |

Runtime SQLite is the product source of truth for chat. App SQLite can cache for
fast UI, but reconnect and hard reload recover from Runtime history and cursors.
Hermes transcripts are execution evidence linked to Tavern messages and stored
through Tavern Runtime.

The channel relay has a small Runtime outbox for channel-style ingress. It
stores only relay state: request id, durable message id, route, cursor, and
acceptance. It does not store message content, nonce, sequence, participants,
or duplicate history. It references existing Runtime chat and message ids; it
never creates chats or repairs chat metadata.

## IDs

Use semantic prefixes at the Tavern API boundary.

| Prefix | Entity |
| --- | --- |
| `cht_` | chat |
| `msg_` | message |
| `rsp_` | response |
| `act_` | response activity |
| `art_` | artifact |
| `usr_` | user participant |
| `agt_` | agent participant |
| `sys_` | system participant |
| `evt_` | event |
| `del_` | delivery |
| `rt_` | runtime connection |

Read markers are scoped records, not standalone product ids.
Hermes ids and runtime agent ids remain source ids. Store them in runtime
metadata or source fields, not as Tavern product ids unless Tavern minted them.

Cortex page identity is `(topic, path)` from the Cortex wiki hub.

## Runtime Chat Tables

```text
chats
chat_participants
chat_messages
chat_responses
chat_response_activity
chat_artifacts
chat_deliveries
chat_events
chat_reads
tavern_highlights
```

These tables live in Runtime SQLite and back the OpenAPI chat contract.

`tavern_channel_outbox` also lives in Runtime SQLite, but it is not chat
history. It is the private relay queue for channel-style ingress and hydrates
frames from existing `chats` and `chat_messages` rows.

`tavern_highlights` is a derived presentation cache. Runtime regenerates current
homepage highlight receipts hourly from recent response activity, chat
responses, and cron runs. It expires old rows and keeps the app from recomputing
cross-domain stats during render.

## `chats`

Durable conversation containers.

```text
chats
  id                    TEXT PRIMARY KEY
  kind                  TEXT NOT NULL        -- channel, dm, thread
  title                 TEXT
  pinned                INTEGER NOT NULL DEFAULT 0
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
  source                TEXT NOT NULL        -- tavern, hermes, discord, system
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
  content               TEXT NOT NULL
  attachment_json       TEXT
  nonce                 TEXT
  source                TEXT NOT NULL        -- tavern, hermes, automation, system
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

Message body fields are rendered content only. `content` stores the durable text
body. `attachment_json` stores the durable attachment array for the message.
Hidden chain-of-thought is never message body content. Provider-exposed
thinking summaries, tool calls, tool results, assistant progress, and status
rows are response activity.

## `chat_responses`

Durable participant responses to chat messages.

```text
chat_responses
  id                       TEXT PRIMARY KEY
  chat_id                  TEXT NOT NULL
  participant_id           TEXT NOT NULL
  request_message_id       TEXT
  response_message_id      TEXT
  status                   TEXT NOT NULL        -- queued, running, completed, failed, cancelled
  summary                  TEXT
  metadata_json            TEXT NOT NULL DEFAULT '{}'
  created_at               TEXT NOT NULL
  updated_at               TEXT NOT NULL
  completed_at             TEXT
  deleted_at               TEXT
```

Indexes:

```text
idx_chat_responses_chat_created(chat_id, created_at, id)
idx_chat_responses_chat_updated(chat_id, updated_at, id)
```

Rules:

* A response is the chat product record for one participant's attempt to answer
  or act on a message.
* Runtime, session, run, and turn ids remain metadata on the response.
* `created_at` defines stable response pagination. `updated_at` changes when
  activity or final state changes.
* Running responses are durable and recoverable after reload.
* Completion or failure updates the same response row.
* Soft delete sets `deleted_at` and keeps the row; activity and artifacts
  follow their response out of the timeline. Dismissal and chat clear use it.

## `chat_response_activity`

Ordered durable work rows inside a response.

```text
chat_response_activity
  id                       TEXT PRIMARY KEY
  response_id              TEXT NOT NULL
  chat_id                  TEXT NOT NULL
  sequence                 INTEGER NOT NULL
  kind                     TEXT NOT NULL        -- planning, reasoning, tool_call, tool_result, command, approval, message, artifact, custom
  status                   TEXT NOT NULL        -- queued, running, completed, failed, cancelled
  title                    TEXT NOT NULL
  detail                   TEXT
  summary                  TEXT
  artifact_ids_json        TEXT NOT NULL DEFAULT '[]'
  metadata_json            TEXT NOT NULL DEFAULT '{}'
  started_at               TEXT NOT NULL
  updated_at               TEXT NOT NULL
  completed_at             TEXT
```

Indexes and uniqueness:

```text
UNIQUE(response_id, sequence)
idx_chat_response_activity_response_sequence(response_id, sequence)
idx_chat_response_activity_chat_sequence(chat_id, sequence)
```

Rules:

* Activity rows are statusful and updated in place as work progresses.
* Activity ids are global and cannot move between chats or responses.
* Tool calls, tool results, thinking summaries, plans, approvals, and message
  references are activity.
* Runtime tool ids, tool names, arguments, results, and source facts live in
  `metadata_json`.
* Reload recovery reads the same activity rows for running and completed
  responses.
* Hidden chain-of-thought is never stored here.

## `chat_artifacts`

Durable renderable outputs attached to a message, response, or activity row.

```text
chat_artifacts
  id                       TEXT PRIMARY KEY
  chat_id                  TEXT NOT NULL
  response_id              TEXT
  activity_id              TEXT
  message_id               TEXT
  kind                     TEXT NOT NULL        -- code, image, file, diff, document, chart, text, custom
  title                    TEXT
  content_text             TEXT
  content_ref              TEXT
  mime_type                TEXT
  metadata_json            TEXT NOT NULL DEFAULT '{}'
  created_at               TEXT NOT NULL
  updated_at               TEXT NOT NULL
```

Indexes:

```text
idx_chat_artifacts_chat_updated(chat_id, updated_at, id)
```

Rules:

* Artifacts are renderable outputs, not tool calls by themselves.
* Code blocks, screenshots, generated images, files, diffs, documents, and
  charts are artifacts.
* Tool activity may reference artifacts it produced.

## `chat_events`

Recoverable notifications inserted with the mutation they describe.

```text
chat_events
  cursor                INTEGER PRIMARY KEY
  id                    TEXT NOT NULL UNIQUE
  event_type            TEXT NOT NULL
  chat_id               TEXT NOT NULL
  event_json            TEXT NOT NULL
  created_at            TEXT NOT NULL
  is_private            INTEGER NOT NULL DEFAULT 0
  recipients_json       TEXT NOT NULL DEFAULT '[]'
```

Indexes and uniqueness:

```text
idx_chat_events_chat_cursor(chat_id, cursor)
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
  reader_id             TEXT NOT NULL
  last_read_sequence    INTEGER NOT NULL
  read_at               TEXT NOT NULL
  cursor                INTEGER NOT NULL
```

Indexes and uniqueness:

```text
PRIMARY KEY(chat_id, reader_id)
```

Rules:

* Reads are monotonic per `(chat_id, reader_id)`.
* The server caps `last_read_sequence` to the chat's current last sequence.
* Read events are private to the reader.

## `chat_deliveries`

Assistant delivery receipts.

```text
chat_deliveries
  id                    TEXT PRIMARY KEY
  chat_id               TEXT NOT NULL
  agent_id              TEXT NOT NULL
  turn_id               TEXT
  message_id            TEXT NOT NULL
  cursor                INTEGER NOT NULL
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
```

Duplicate `delivery.id` returns the existing delivery receipt. Duplicate
assistant `message.id` links the delivery to the existing durable message
instead of creating another message row.

## Runtime Execution Evidence

Hermes execution links to Tavern messages.

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
  response_id           TEXT
  response_message_id   TEXT
  agent_id              TEXT NOT NULL
  session_key           TEXT NOT NULL
  hermes_run_id       TEXT
  status                TEXT NOT NULL
  started_at            TEXT
  finished_at           TEXT

runtime_transcript_messages
  id                    TEXT PRIMARY KEY
  chat_id               TEXT
  message_id            TEXT
  session_key           TEXT NOT NULL
  session_id            TEXT
  hermes_message_id   TEXT
  seq                   INTEGER
  role                  TEXT NOT NULL
  content_text          TEXT
  raw_json              TEXT NOT NULL
  synced_at             TEXT NOT NULL

runtime_tool_calls
  id                    TEXT PRIMARY KEY
  chat_id               TEXT
  response_id           TEXT
  activity_id           TEXT
  message_id            TEXT
  session_key           TEXT NOT NULL
  run_id                TEXT
  tool_call_id          TEXT
  tool_name             TEXT NOT NULL
  status                TEXT
  raw_json              TEXT NOT NULL
  updated_at            TEXT NOT NULL
```

Hermes transcript messages, tool calls, links, and artifacts are runtime
evidence. Sync paths map user-visible work into responses, response activity,
and artifacts by stable ids. They enrich the UI, but they do not replace
canonical chat history.

## Cortex Wiki Files

Tavern Runtime does not store Cortex tables. It resolves the Cortex wiki hub and
reads Markdown files directly.

```text
topics/<topic>/
  _index.md
  config.md
  log.md
  wiki/
  raw/
  todos/
  datasets/
  output/
  inbox/
topics/.archive/<topic>/
```

Rules:

* Runtime never creates a second canonical copy of wiki pages.
* Page identity is the topic slug plus Markdown path.
* Frontmatter parsing is light and display-oriented.
* Wikilinks and backlinks are derived from Markdown bodies.
* Imports, compiles, audits, and maintenance are managed wiki agent workflows.

## Transaction Rules

Message create:

1. Open `BEGIN IMMEDIATE`.
2. Resolve duplicate `message.id` or `(chat_id, nonce)`.
3. Assign `sequence = MAX(sequence) + 1` for the chat.
4. Insert `chat_messages`.
5. Insert `chat_events(message.created)` with the same sequence.
6. Commit.

Assistant delivery:

1. Open `BEGIN IMMEDIATE`.
2. Resolve duplicate `delivery.id`.
3. Insert `chat_deliveries`.
4. Create or link the assistant `chat_messages` row when final text exists.
5. Insert `chat_events(message.delivered)`.
6. Commit.

Activity update:

1. Open `BEGIN IMMEDIATE`.
2. Resolve or create `chat_responses`.
3. Upsert `chat_response_activity` by stable activity or runtime tool id.
4. Upsert any referenced `chat_artifacts`.
5. Insert `chat_events(response.*|activity.*|artifact.*)`.
6. Commit.

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
| `session_runs` | runtime session/turn evidence linked to `chat_responses` |
| `session_messages` | `runtime_transcript_messages` evidence |
| `session_message_parts` | transcript evidence and candidate `chat_artifacts` |
| `session_tool_calls` | tool evidence linked to `chat_response_activity` |
| `session_artifacts` | candidate `chat_artifacts` |
| `session_deliveries` | `chat_deliveries` or runtime delivery evidence |
| `cron_jobs` | `automations` |
| `cron_runs` | `automation_runs` |

## FTS

Search has first-class indexing for:

* chat messages
* Cortex pages and files

SQLite FTS mirrors durable text fields through triggers or explicit
transactional writes. Search indexes are derived state, not the source of truth.

## Invariants

* Tavern Runtime chat history is canonical product state.
* Chat pinned state is a first-class Runtime chat field, not app-local
  presentation state.
* Hermes transcript history is runtime-owned evidence.
* Runtime adapters preserve source ids and metadata without authoring final
  Tavern presentation.
* Reconciliation uses ids, nonces, sequences, delivery ids, session keys, and
  run ids.
* Reconciliation never uses content/timestamp duplicate detection.
* Events notify; runtime durable reads recover.
* Response activity is durable and statusful.
* App-local progress hints never become a second chat history.
* Cortex wiki reads fail visibly when the Cortex wiki hub is missing or unreadable.

## Related Docs

* [API overview](../api/overview.md)
* [Chat API](../api/chat.md)
* [Realtime](../api/realtime.md)
* [Tavern Runtime](runtime.md)
* [Architecture overview](architecture-overview.md)
* [Tavern Runtime Chat Server](../../specs/runtime-chat-server.md)
* [Memories](../../specs/memories.md)
* [Cortex](../../specs/cortex.md)
