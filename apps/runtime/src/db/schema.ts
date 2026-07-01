import { repairRuntimeSchema } from './schema-repairs.ts';
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

CREATE TABLE IF NOT EXISTS runtime_plugins (
  id          TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_plugin_secrets (
  plugin_id   TEXT PRIMARY KEY,
  secret_json TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY(plugin_id) REFERENCES runtime_plugins(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS agent_skill_assignments (
  agent_id   TEXT NOT NULL,
  skill_id   TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(agent_id, skill_id),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_skill_assignments_enabled
  ON agent_skill_assignments(agent_id, enabled, skill_id);

CREATE TABLE IF NOT EXISTS agent_plugin_grants (
  agent_id   TEXT NOT NULL,
  plugin_id  TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(agent_id, plugin_id),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY(plugin_id) REFERENCES runtime_plugins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_plugin_grants_enabled
  ON agent_plugin_grants(agent_id, enabled, plugin_id);

CREATE TABLE IF NOT EXISTS agent_mcp_grants (
  agent_id        TEXT NOT NULL,
  mcp_server_name TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY(agent_id, mcp_server_name),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_mcp_grants_enabled
  ON agent_mcp_grants(agent_id, enabled, mcp_server_name);

CREATE TABLE IF NOT EXISTS agent_runtime_profiles (
  agent_id           TEXT PRIMARY KEY,
  default_model_json TEXT NOT NULL,
  sandbox_mode       TEXT NOT NULL DEFAULT 'none' CHECK (sandbox_mode IN ('docker', 'none', 'podman')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_model_selections (
  agent_id          TEXT PRIMARY KEY,
  provider_id       TEXT NOT NULL,
  model_id          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('invalid', 'unknown', 'valid')),
  invalid_reason    TEXT,
  last_validated_at TEXT,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_catalog_cache (
  provider_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  models_json TEXT NOT NULL,
  warning TEXT,
  refreshed_at TEXT NOT NULL,
  expires_at TEXT,
  fingerprint TEXT
);

CREATE TABLE IF NOT EXISTS runtime_model_providers (
  provider_id TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm')),
  title                 TEXT,
  pinned                INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id                  TEXT NOT NULL,
  id                       TEXT NOT NULL,
  kind                     TEXT NOT NULL CHECK (kind IN ('user', 'agent', 'system', 'external', 'plugin')),
  label                    TEXT,
  metadata_json            TEXT NOT NULL DEFAULT '{}',
  current_agent_session_id TEXT,
  PRIMARY KEY(chat_id, id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id                     TEXT PRIMARY KEY,
  chat_id                TEXT NOT NULL,
  agent_participant_id   TEXT NOT NULL,
  agent_id               TEXT NOT NULL,
  generation             INTEGER NOT NULL CHECK (generation > 0),
  effective_model_json   TEXT NOT NULL,
  runtime_session_id     TEXT,
  resume_state_json      TEXT,
  status                 TEXT NOT NULL CHECK (status IN ('active', 'archived', 'stopped')),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  archived_at            TEXT,
  UNIQUE(chat_id, agent_participant_id, generation),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(chat_id, agent_participant_id) REFERENCES chat_participants(chat_id, id) ON DELETE CASCADE,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_seat_generation
  ON agent_sessions(chat_id, agent_participant_id, generation DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent
  ON agent_sessions(agent_id, status, updated_at);

CREATE TABLE IF NOT EXISTS agent_turns (
  id                      TEXT PRIMARY KEY,
  chat_id                 TEXT NOT NULL,
  agent_session_id        TEXT NOT NULL,
  agent_participant_id    TEXT NOT NULL,
  agent_id                TEXT NOT NULL,
  trigger_message_id      TEXT NOT NULL,
  response_id             TEXT NOT NULL,
  status                  TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  attempt                 INTEGER NOT NULL CHECK (attempt > 0),
  output_message_ids_json TEXT NOT NULL DEFAULT '[]',
  activity_ids_json       TEXT NOT NULL DEFAULT '[]',
  metadata_json           TEXT NOT NULL DEFAULT '{}',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  started_at              TEXT,
  completed_at            TEXT,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(agent_session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(trigger_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY(response_id) REFERENCES chat_responses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_turns_session_status
  ON agent_turns(agent_session_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_turns_chat_updated
  ON agent_turns(chat_id, updated_at);

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
  kind           TEXT NOT NULL CHECK (kind IN ('planning', 'reasoning', 'tool_call', 'tool_result', 'command', 'message', 'artifact', 'rich_response', 'custom')),
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

CREATE TABLE IF NOT EXISTS memory_health_history (
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

CREATE INDEX IF NOT EXISTS idx_memory_health_history_topic
  ON memory_health_history(topic, recorded_at);
`;

export function ensureRuntimeSchema(db: Database): void {
    db.exec(RUNTIME_SCHEMA);
    repairRuntimeSchema(db);
    ensureColumn(db, {
        column: 'kind',
        definition: "TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm'))",
        table: 'chats',
    });
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
    ensureColumn(db, {
        column: 'current_agent_session_id',
        definition: 'TEXT',
        table: 'chat_participants',
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
