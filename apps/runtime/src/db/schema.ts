import type { Database } from './sqlite.ts';

export const RUNTIME_SCHEMA = `
CREATE TABLE IF NOT EXISTS runtime_metadata (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_vault_secrets (
  id          TEXT PRIMARY KEY,
  secret_json TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_capabilities (
  id                TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  state             TEXT NOT NULL CHECK (state IN ('degraded', 'healthy', 'unauthorized', 'unavailable', 'unknown')),
  healthy           INTEGER NOT NULL CHECK (healthy IN (0, 1)),
  reason            TEXT,
  technical_message TEXT,
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  checked_at        TEXT,
  last_healthy_at   TEXT,
  next_check_at     TEXT,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_agent_instructions (
  agent_id      TEXT PRIMARY KEY,
  agent_name    TEXT NOT NULL,
  workspace_dir TEXT NOT NULL,
  rendered_hash TEXT,
  rendered_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  avatar                 TEXT,
  emoji                  TEXT,
  primary_color          TEXT,
  workspace_folder       TEXT NOT NULL,
  enabled_skill_ids_json TEXT NOT NULL DEFAULT '[]',
  is_admin               INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  raw_json               TEXT NOT NULL,
  last_synced_at         TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_name
  ON agents(name, id);

CREATE TABLE IF NOT EXISTS hermes_session_mappings (
  tavern_session_key TEXT PRIMARY KEY,
  hermes_session_key TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
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
  pinned                INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
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
  content           TEXT NOT NULL DEFAULT '',
  attachment_json   TEXT,
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

CREATE TABLE IF NOT EXISTS chat_responses (
  id                  TEXT PRIMARY KEY,
  chat_id             TEXT NOT NULL,
  participant_id      TEXT NOT NULL,
  request_message_id  TEXT,
  response_message_id TEXT,
  status              TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  summary             TEXT,
  metadata_json       TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  completed_at        TEXT,
  deleted_at          TEXT,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(request_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL,
  FOREIGN KEY(response_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_responses_chat_updated
  ON chat_responses(chat_id, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_chat_responses_chat_created
  ON chat_responses(chat_id, created_at, id);

CREATE TABLE IF NOT EXISTS chat_response_activity (
  id             TEXT PRIMARY KEY,
  response_id    TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('planning', 'reasoning', 'tool_call', 'tool_result', 'command', 'approval', 'message', 'artifact', 'custom')),
  status         TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  title          TEXT NOT NULL,
  detail         TEXT,
  summary        TEXT,
  artifact_ids_json TEXT NOT NULL DEFAULT '[]',
  metadata_json  TEXT NOT NULL DEFAULT '{}',
  started_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  completed_at   TEXT,
  FOREIGN KEY(response_id) REFERENCES chat_responses(id) ON DELETE CASCADE,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  UNIQUE(response_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_chat_response_activity_response_sequence
  ON chat_response_activity(response_id, sequence);

CREATE INDEX IF NOT EXISTS idx_chat_response_activity_chat_sequence
  ON chat_response_activity(chat_id, sequence);

CREATE TABLE IF NOT EXISTS chat_artifacts (
  id            TEXT PRIMARY KEY,
  chat_id       TEXT NOT NULL,
  response_id   TEXT,
  activity_id   TEXT,
  message_id    TEXT,
  kind          TEXT NOT NULL CHECK (kind IN ('code', 'image', 'file', 'diff', 'document', 'chart', 'text', 'custom')),
  title         TEXT,
  content_text  TEXT,
  content_ref   TEXT,
  mime_type     TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(response_id) REFERENCES chat_responses(id) ON DELETE SET NULL,
  FOREIGN KEY(activity_id) REFERENCES chat_response_activity(id) ON DELETE SET NULL,
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_artifacts_chat_updated
  ON chat_artifacts(chat_id, updated_at, id);

CREATE TABLE IF NOT EXISTS tavern_highlights (
  id                 TEXT PRIMARY KEY,
  category           TEXT NOT NULL,
  headline           TEXT NOT NULL,
  receipt            TEXT NOT NULL,
  metric_json        TEXT NOT NULL DEFAULT '{}',
  source_refs_json   TEXT NOT NULL DEFAULT '[]',
  window_start       TEXT NOT NULL,
  window_end         TEXT NOT NULL,
  generated_at       TEXT NOT NULL,
  expires_at         TEXT NOT NULL,
  generator_version  INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_tavern_highlights_expires
  ON tavern_highlights(expires_at, category);

CREATE INDEX IF NOT EXISTS idx_tavern_highlights_generated
  ON tavern_highlights(generated_at, category);

CREATE TABLE IF NOT EXISTS wiki_health_history (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  topic              TEXT NOT NULL,
  scan_id            TEXT,
  recorded_at        TEXT NOT NULL,
  articles_scanned   INTEGER,
  stale_count        INTEGER,
  low_quality_count  INTEGER,
  avg_staleness      REAL,
  avg_quality        REAL
);

CREATE INDEX IF NOT EXISTS idx_wiki_health_history_topic
  ON wiki_health_history(topic, recorded_at);
`;

export function ensureRuntimeSchema(db: Database): void {
    db.exec(RUNTIME_SCHEMA);
    ensureColumn(db, {
        column: 'pinned',
        definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1))',
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'deleted_at',
        definition: 'TEXT',
        table: 'chat_responses',
    });
}

function ensureColumn(
    db: Database,
    input: { column: string; definition: string; table: string }
): void {
    const rows = db.prepare(`PRAGMA table_info(${input.table})`).all() as Array<{ name: string }>;

    if (rows.some((row) => row.name === input.column)) {
        return;
    }

    db.exec(`ALTER TABLE ${input.table} ADD COLUMN ${input.column} ${input.definition}`);
}
