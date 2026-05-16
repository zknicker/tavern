import type { Database } from './sqlite';

export const RUNTIME_SCHEMA = `
CREATE TABLE IF NOT EXISTS runtime_metadata (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_channel_messages (
  id                TEXT PRIMARY KEY,
  chat_id           TEXT NOT NULL,
  conversation_kind TEXT NOT NULL CHECK (conversation_kind IN ('channel', 'dm', 'thread')),
  account_id        TEXT NOT NULL DEFAULT 'default',
  agent_id          TEXT NOT NULL,
  session_key       TEXT NOT NULL,
  request_id        TEXT NOT NULL,
  run_id            TEXT NOT NULL,
  nonce             TEXT,
  parent_message_id TEXT,
  thread_root_id    TEXT,
  sender_id         TEXT NOT NULL,
  sender_name       TEXT NOT NULL,
  body              TEXT NOT NULL,
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  sequence          INTEGER NOT NULL,
  cursor            INTEGER NOT NULL,
  accepted_at       TEXT NOT NULL,
  plugin_accepted_at TEXT,
  sent_at           TEXT NOT NULL,
  UNIQUE(chat_id, sequence),
  UNIQUE(chat_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_tavern_channel_messages_chat_sequence
  ON tavern_channel_messages(chat_id, sequence);

CREATE TABLE IF NOT EXISTS tavern_channel_events (
  cursor        INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type    TEXT NOT NULL,
  chat_id       TEXT NOT NULL,
  session_key   TEXT,
  run_id        TEXT,
  delivery_id   TEXT,
  event_json    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  is_private    INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
  recipients_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE(delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_tavern_channel_events_chat_cursor
  ON tavern_channel_events(chat_id, cursor);

CREATE TABLE IF NOT EXISTS tavern_channel_reads (
  chat_id            TEXT NOT NULL,
  reader_id          TEXT NOT NULL,
  session_key        TEXT,
  agent_id           TEXT,
  last_read_sequence INTEGER NOT NULL,
  read_at            TEXT NOT NULL,
  PRIMARY KEY(chat_id, reader_id)
);
`;

export function ensureRuntimeSchema(db: Database): void {
    db.exec(RUNTIME_SCHEMA);
}
