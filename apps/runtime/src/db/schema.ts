import type { Database } from './sqlite';

export const RUNTIME_SCHEMA = `
CREATE TABLE IF NOT EXISTS runtime_metadata (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_agent_instructions (
  agent_id      TEXT PRIMARY KEY,
  agent_name    TEXT NOT NULL,
  workspace_dir TEXT NOT NULL,
  soul          TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  rendered_hash TEXT,
  rendered_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_channel_outbox (
  request_id        TEXT PRIMARY KEY,
  message_id        TEXT NOT NULL UNIQUE,
  chat_id           TEXT NOT NULL,
  conversation_kind TEXT NOT NULL CHECK (conversation_kind IN ('channel', 'dm', 'thread')),
  account_id        TEXT NOT NULL DEFAULT 'default',
  agent_id          TEXT NOT NULL,
  session_key       TEXT NOT NULL,
  run_id            TEXT NOT NULL,
  cursor            INTEGER NOT NULL,
  accepted_at       TEXT NOT NULL,
  plugin_accepted_at TEXT,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tavern_channel_outbox_pending
  ON tavern_channel_outbox(plugin_accepted_at, cursor);

CREATE TABLE IF NOT EXISTS chats (
  id                    TEXT PRIMARY KEY,
  title                 TEXT,
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id       TEXT NOT NULL,
  id            TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('user', 'agent', 'system', 'integration')),
  label         TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(chat_id, id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                TEXT PRIMARY KEY,
  chat_id           TEXT NOT NULL,
  sequence          INTEGER NOT NULL,
  author_id         TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  nonce             TEXT,
  parent_message_id TEXT,
  thread_root_id    TEXT,
  delivery_id       TEXT,
  created_at        TEXT NOT NULL,
  deleted_at        TEXT,
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  UNIQUE(chat_id, sequence),
  UNIQUE(chat_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_sequence
  ON chat_messages(chat_id, sequence);

CREATE TABLE IF NOT EXISTS chat_message_parts (
  id            TEXT PRIMARY KEY,
  message_id    TEXT NOT NULL,
  part_index    INTEGER NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('text', 'reasoning', 'tool_call', 'tool_result', 'attachment')),
  content       TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  UNIQUE(message_id, part_index)
);

CREATE TABLE IF NOT EXISTS chat_events (
  cursor          INTEGER PRIMARY KEY,
  id              TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  chat_id         TEXT NOT NULL,
  event_json      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  is_private      INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
  recipients_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_events_chat_cursor
  ON chat_events(chat_id, cursor);

CREATE TABLE IF NOT EXISTS chat_reads (
  chat_id            TEXT NOT NULL,
  reader_id          TEXT NOT NULL,
  last_read_sequence INTEGER NOT NULL,
  read_at            TEXT NOT NULL,
  cursor             INTEGER NOT NULL,
  PRIMARY KEY(chat_id, reader_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_deliveries (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  turn_id     TEXT,
  message_id  TEXT NOT NULL,
  cursor      INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_activity (
  chat_id       TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  summary       TEXT,
  steps_json    TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at    TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
`;

export function ensureRuntimeSchema(db: Database): void {
    db.exec(RUNTIME_SCHEMA);
}
