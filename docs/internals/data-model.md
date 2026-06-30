---
summary: Tavern data model for Runtime chat tables, responses, activity, artifacts, semantic ids, transactions, execution evidence, app cache, FTS, and invariants.
read_when:
  - changing SQLite tables, ids, sync invariants, or runtime transcript storage
  - changing chat/session/message identity, event recovery, or sync semantics
---

# Data Model

Tavern Runtime is the always-on chat server.

Agents participate in Tavern chats as Runtime-owned chat participants. An agent
participant is an Agent seat, and the seat points at its current Agent session.
The engine owns model calls, tools, files, and native execution details. Tavern
Runtime owns chats, participants, Agent sessions, messages, responses, activity,
artifacts, sequence, events, reads, soft deletes, automations, deliveries, and
the product timeline.

## Source Files

| Layer                    | Source                                              | Role                                                                                        |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Runtime schema           | `apps/runtime/src/db/schema.ts`                     | Runtime SQLite schema and fresh setup                                                       |
| Runtime chat store       | `apps/runtime/src/tavern/chat-api/`                 | OpenAPI-backed chat, message, response, activity, artifact, delivery, read, and event store |
| Runtime channel relay    | `apps/runtime/src/tavern/channel-relay.ts`          | Durable message acceptance and agent turn startup                                           |
| Runtime agent sessions   | `apps/runtime/src/tavern/agent-session-store.ts`    | Agent seat current session state, rotation, and repair                                      |
| Runtime model profiles   | `apps/runtime/src/models/runtime-profile-store.ts`  | Per-agent default execution model for new Agent sessions                                     |
| Vault store              | `apps/runtime/src/vault/`                           | Runtime read API over the user's Markdown wiki                                              |
| Runtime chat tests       | `apps/runtime/src/tavern/chat-api-store.test.ts`    | Contract, identity, sequence, event, read, and route behavior                               |
| Runtime timeline tests   | `apps/runtime/src/tavern/chat-api-timeline.test.ts` | Turn-aligned history pages, cursor stability, and window alignment                          |
| App schema               | `apps/server/src/db/bootstrap.ts`                   | App SQLite fresh setup                                                                      |
| App Drizzle schema       | `apps/server/src/db/schema/`                        | Typed app cache and synced runtime tables                                                   |
| Tavern API package       | `packages/tavern-api/src/`                          | OpenAPI-generated and Zod-backed API contracts                                              |
| Agent execution evidence | Runtime SQLite                                      | Native execution and transcripts                                                            |

## Store Boundaries

| Store                    | Owner                                      | Contents                                                                                                                          |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Runtime SQLite           | Tavern Runtime                             | Canonical chat model, automation delivery, agent seats, Agent sessions, cursor-backed events, read markers, runtime metadata |
| App SQLite               | Tavern App                                 | Client cache, app-shell preferences, and presentation state                                                                       |
| Vault wiki               | Managed `vault` skill and agent file tools | Markdown pages under the configured wiki root                                                                                     |
| Agent execution evidence | Tavern Runtime                             | Sessions, turns, tools, model calls, transcripts, and files                                                                       |

Runtime SQLite is the product source of truth for chat. App SQLite can cache for
fast UI, but reconnect and hard reload recover from Runtime history and cursors.
Agent transcripts are execution evidence linked to Tavern messages and stored
through Tavern Runtime.

The channel relay writes durable chat records and dispatches through the
agent seat's current Agent session. It does not keep a private outbox, duplicate
message history, or invent chat metadata.

## IDs

Use semantic prefixes at the Tavern API boundary.

| Prefix | Entity             |
| ------ | ------------------ |
| `cht_` | chat               |
| `msg_` | message            |
| `rsp_` | response           |
| `act_` | response activity  |
| `art_` | artifact           |
| `usr_` | user participant   |
| `agt_` | agent participant  |
| `sys_` | system participant |
| `ags_` | Agent session      |
| `evt_` | event              |
| `del_` | delivery           |
| `rt_`  | runtime connection |

Read markers are scoped records, not standalone product ids.
Engine ids and runtime agent ids remain source ids. Store them in runtime
metadata or source fields, not as Tavern product ids unless Tavern minted them.

Vault page identity is the Markdown path relative to the configured wiki root.

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
```

These tables live in Runtime SQLite and back the OpenAPI chat contract.

Agent sessions also live in Runtime SQLite. They are execution routing state,
not chat history.

Agent turns also live in Runtime SQLite. They are durable execution state linked
to messages and responses, while active stream state remains in Runtime memory.

Agent runtime profiles also live in Runtime SQLite. They are per-agent
execution defaults for new Agent sessions, not agent identity fields.

```text
agent_runtime_profiles
  agent_id              TEXT PRIMARY KEY
  default_model_json    TEXT NOT NULL
  sandbox_mode          TEXT NOT NULL        -- none, docker, podman
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL

agent_model_selections
  agent_id              TEXT PRIMARY KEY
  provider_id           TEXT NOT NULL
  model_id              TEXT NOT NULL
  status                TEXT NOT NULL        -- unknown, valid, invalid
  invalid_reason        TEXT
  last_validated_at     TEXT
  updated_at            TEXT NOT NULL
```

Rules:

- One row exists at most per Runtime agent.
- Missing runtime profiles resolve to Runtime provider defaults.
- `agents.raw_json` does not store model choices.
- Catalog rows are read inventory.
- `agent_runtime_profiles.default_model_json` sets the model for future Agent
  sessions.
- `agent_sessions.effective_model_json` is the model actually used by that
  session.
- The app changes the model for the current Tavern Agent seat by writing the
  current Agent session model, not by mutating app-local settings.

## `chats`

Durable conversation containers.

```text
chats
  id                    TEXT PRIMARY KEY
  kind                  TEXT NOT NULL        -- channel, dm
  title                 TEXT
  pinned                INTEGER NOT NULL DEFAULT 0  -- legacy Runtime field; Tavern App ignores it
  metadata_json         TEXT NOT NULL DEFAULT '{}'
  created_at            TEXT NOT NULL
  updated_at            TEXT NOT NULL
  last_message_sequence INTEGER NOT NULL DEFAULT 0
```

Indexes:

```text
PRIMARY KEY(id)
```

Rules:

- Runtime bootstraps the fresh Tavern workspace with `cht_general` as
  `kind: channel`, display name `general`, seeded channel color, and a primary
  agent DM as `kind: dm`.
- A DM has exactly two participants.
- Chat archival and presentation state currently live in `metadata_json`.

## `chat_participants`

Actors that can author messages or receive private events.

```text
chat_participants
  chat_id                  TEXT NOT NULL
  id                       TEXT NOT NULL
  kind                     TEXT NOT NULL        -- user, agent, system, external, plugin
  label                    TEXT
  metadata_json            TEXT NOT NULL DEFAULT '{}'
  current_agent_session_id TEXT
```

Indexes:

```text
PRIMARY KEY(chat_id, id)
```

Do not merge participants by display name. Participant labels are source
provenance, not person identity assertions.

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
  source                TEXT NOT NULL        -- tavern, agent-engine, automation, system
  request_id            TEXT
  delivery_id           TEXT
  run_id                TEXT
  agent_session_id      TEXT
  engine_session_id     TEXT
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
idx_chat_messages_agent_session(agent_session_id)
```

Rules:

- Message creation is durable before model work starts.
- A channel message starts no agent work unless its Tavern mention metadata
  addresses one or more agent participants in that chat.
- An agent DM addresses its one agent participant implicitly.
- Sequence is assigned in the message insert transaction.
- Duplicate `message.id` returns the existing message.
- Duplicate `(chat_id, nonce)` returns the existing message.
- Content, timestamp, and display text are never duplicate keys.
- Soft delete updates `status` and `deleted_at`; it keeps the row and sequence.

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

- A response is the chat product record for one participant's attempt to answer
  or act on a message.
- Runtime, session, run, and turn ids remain metadata on the response.
- `created_at` defines stable response pagination. `updated_at` changes when
  activity or final state changes.
- Running responses are durable and recoverable after reload.
- Completion or failure updates the same response row.
- Soft delete sets `deleted_at` and keeps the row; activity and artifacts
  follow their response out of the timeline. Dismissal and chat clear use it.

## `agent_turns`

Durable execution records for one Agent seat handling one triggering message.

```text
agent_turns
  id                      TEXT PRIMARY KEY        -- run_...
  chat_id                 TEXT NOT NULL
  agent_session_id        TEXT NOT NULL
  agent_participant_id    TEXT NOT NULL
  agent_id                TEXT NOT NULL
  trigger_message_id      TEXT NOT NULL
  response_id             TEXT NOT NULL
  status                  TEXT NOT NULL           -- queued, running, completed, failed, cancelled
  attempt                 INTEGER NOT NULL
  output_message_ids_json TEXT NOT NULL DEFAULT '[]'
  activity_ids_json       TEXT NOT NULL DEFAULT '[]'
  metadata_json           TEXT NOT NULL DEFAULT '{}'
  created_at              TEXT NOT NULL
  updated_at              TEXT NOT NULL
  started_at              TEXT
  completed_at            TEXT
```

Indexes:

```text
idx_agent_turns_session_status(agent_session_id, status, created_at)
idx_agent_turns_chat_updated(chat_id, updated_at)
```

Rules:

- A turn is owned by one Agent session and one Agent seat.
- A turn points at the durable triggering message and response row.
- `output_message_ids_json` records durable assistant message ids produced by
  the turn.
- `activity_ids_json` records durable response activity ids produced by the
  turn.
- One Agent seat may have at most one running turn for its current Agent
  session. Later addressed messages queue as `queued` turns.
- Different Agent seats may have running turns concurrently.
- Active streaming and cancellation handles are transient Runtime memory, not
  chat history.
- Stop transitions a queued or running turn to `cancelled` and settles the
  linked response as `cancelled`.

## `chat_response_activity`

Ordered durable work rows inside a response.

```text
chat_response_activity
  id                       TEXT PRIMARY KEY
  response_id              TEXT NOT NULL
  chat_id                  TEXT NOT NULL
  sequence                 INTEGER NOT NULL
  kind                     TEXT NOT NULL        -- planning, reasoning, tool_call, tool_result, command, message, artifact, rich_response, custom
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

- Activity rows are statusful and updated in place as work progresses.
- Activity ids are global and cannot move between chats or responses.
- Tool calls, tool results, thinking summaries, plans, and message
  references are activity.
- Runtime tool ids, tool names, arguments, results, and source facts live in
  `metadata_json`.
- Reload recovery reads the same activity rows for running and completed
  responses.
- Hidden chain-of-thought is never stored here.

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

- Artifacts are renderable outputs, not tool calls by themselves.
- Code blocks, screenshots, generated images, files, diffs, documents, and
  charts are artifacts.
- Tool activity may reference artifacts it produced.

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

- Insert durable events in the same transaction as the mutation.
- Cursor is monotonic inside Runtime SQLite.
- Websocket delivery is best-effort.
- Clients recover by asking for events after a cursor or by reading the durable
  resource.
- Large state lives in tables, not event payloads.

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

- Reads are monotonic per `(chat_id, reader_id)`.
- The server caps `last_read_sequence` to the chat's current last sequence.
- Read events are private to the reader.

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

## `agent_sessions`

Stable execution context for one agent seat in one Chat. Rotating the current
session starts a fresh context for that agent in that Chat without removing the
agent participant or changing other chats that use the same agent definition.

```text
agent_sessions
  id                     TEXT PRIMARY KEY
  chat_id                TEXT NOT NULL
  agent_participant_id   TEXT NOT NULL
  agent_id               TEXT NOT NULL
  generation             INTEGER NOT NULL
  effective_model_json   TEXT NOT NULL
  runtime_session_id     TEXT
  resume_state_json      TEXT
  status                 TEXT NOT NULL        -- active, archived, stopped
  created_at             TEXT NOT NULL
  updated_at             TEXT NOT NULL
  archived_at            TEXT
```

Rules:

- One agent seat points at one current Agent session through
  `chat_participants.current_agent_session_id`.
- Starting a new session archives previous active sessions for that seat and
  updates only that seat's current pointer.
- `effective_model_json` stores the model used by that session. Same
  execution-kind model changes update the current session in place.
- Switching to a model with a different execution kind starts a new Agent
  session for that seat and archives the previous active session.
- Runtime repair chooses the latest active session when the current pointer is
  missing and archives extra active sessions. If none exists, Runtime creates a
  new session.

Uniqueness:

```text
UNIQUE(chat_id, agent_participant_id, generation)
```

## Runtime Execution Evidence

Agent execution evidence links to Tavern messages through the Agent session.
The engine session id is execution evidence, not product routing identity.

```text
runtime_turns
  id                    TEXT PRIMARY KEY
  conversation_id       TEXT NOT NULL
  request_message_id    TEXT
  response_id           TEXT
  response_message_id   TEXT
  agent_id              TEXT NOT NULL
  agent_session_id      TEXT NOT NULL
  engine_run_id         TEXT
  status                TEXT NOT NULL
  started_at            TEXT
  finished_at           TEXT

runtime_transcript_messages
  id                    TEXT PRIMARY KEY
  conversation_id       TEXT
  message_id            TEXT
  agent_session_id      TEXT NOT NULL
  engine_session_id     TEXT
  engine_message_id     TEXT
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
  agent_session_id      TEXT NOT NULL
  run_id                TEXT
  tool_call_id          TEXT
  tool_name             TEXT NOT NULL
  status                TEXT
  raw_json              TEXT NOT NULL
  updated_at            TEXT NOT NULL
```

Agent transcript messages, tool calls, links, and artifacts are runtime
evidence. Sync paths map user-visible work into responses, response activity,
and artifacts by stable ids. They enrich the UI, but they do not replace
canonical chat history.

## Vault Files

Tavern Runtime does not store Vault page tables. It resolves the Vault root and
reads Markdown files directly.

```text
INDEX.md
projects/example.md
research/example/...
```

Rules:

- Runtime never creates a second canonical copy of wiki pages.
- Page identity is the Markdown path relative to the Vault root.
- Frontmatter parsing is light and display-oriented.
- Wikilinks and backlinks are derived from Markdown bodies.
- Imports, research, and maintenance are agent workflows, not Runtime jobs.

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

App tables are cache, presentation, or execution evidence:

| Current table           | Runtime role                                             |
| ----------------------- | -------------------------------------------------------- |
| `session_runs`          | runtime session/turn evidence linked to `chat_responses` |
| `session_messages`      | `runtime_transcript_messages` evidence                   |
| `session_message_parts` | transcript evidence and candidate `chat_artifacts`       |
| `session_tool_calls`    | tool evidence linked to `chat_response_activity`         |
| `session_artifacts`     | candidate `chat_artifacts`                               |
| `session_deliveries`    | `chat_deliveries` or runtime delivery evidence           |
| `cron_jobs`             | `automations`                                            |
| `cron_runs`             | `automation_runs`                                        |

## FTS

Search has first-class indexing for:

- chat messages
- Vault pages and files

SQLite FTS mirrors durable text fields through triggers or explicit
transactional writes. Search indexes are derived state, not the source of truth.

## Invariants

- Tavern Runtime chat history is canonical product state.
- Channels and DMs are durable chat rooms; Tavern App does not model pinned
  chats.
- The agent Chat participant is the stable Agent seat for an agent in a Chat.
- Agent sessions can rotate without changing the Agent seat.
- Agent transcript history is runtime-owned execution evidence.
- Runtime adapters preserve source ids and metadata without authoring final
  Tavern presentation.
- Reconciliation uses ids, nonces, sequences, delivery ids, Agent session ids,
  and run ids.
- Reconciliation never uses content/timestamp duplicate detection.
- Events notify; runtime durable reads recover.
- Response activity is durable and statusful.
- App-local progress hints never become a second chat history.
- Vault reads fail visibly when the configured root is missing or unreadable.

## Related Docs

- [API overview](../api/overview.md)
- [Chat API](../api/chat.md)
- [Realtime](../api/realtime.md)
- [Tavern Runtime](runtime.md)
- [Architecture overview](architecture-overview.md)
- [Tavern Runtime Chat Server](../../specs/runtime-chat-server.md)
- [Memories](../../specs/memories.md)
- [Vault](../../specs/vault.md)
