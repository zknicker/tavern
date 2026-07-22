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

CREATE TABLE IF NOT EXISTS skill_sources (
  skill_id            TEXT PRIMARY KEY,
  source              TEXT NOT NULL CHECK (source IN ('seeded', 'hub', 'agent', 'external', 'plugin')),
  state               TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'stale', 'archived')),
  created_by_agent_id TEXT,
  installed_hash      TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT
);

CREATE TABLE IF NOT EXISTS skill_usage (
  skill_id    TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('injected', 'viewed')),
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skill_usage_skill_occurred
  ON skill_usage(skill_id, occurred_at);

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
  kind                  TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm', 'task', 'thread')),
  title                 TEXT,
  parent_chat_id        TEXT REFERENCES chats(id) ON DELETE CASCADE,
  anchor_message_id     TEXT,
  pinned                INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS thread_follows (
  thread_chat_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  followed       INTEGER NOT NULL DEFAULT 1 CHECK (followed IN (0, 1)),
  created_at     TEXT NOT NULL,
  PRIMARY KEY (thread_chat_id, participant_id),
  FOREIGN KEY (thread_chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id                  TEXT NOT NULL,
  id                       TEXT NOT NULL,
  kind                     TEXT NOT NULL CHECK (kind IN ('user', 'agent', 'system', 'external', 'plugin')),
  label                    TEXT,
  metadata_json            TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(chat_id, id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- One global session per agent spanning all its chats (specs/sessions.md,
-- ADR 0011). Chat-scoped state lives in agent_session_chat_cursors.
CREATE TABLE IF NOT EXISTS agent_sessions (
  id                     TEXT PRIMARY KEY,
  agent_id               TEXT NOT NULL,
  generation             INTEGER NOT NULL CHECK (generation > 0),
  effective_model_json   TEXT NOT NULL,
  runtime_session_id     TEXT,
  resume_state_json      TEXT,
  instructions_hash      TEXT,
  status                 TEXT NOT NULL CHECK (status IN ('active', 'archived', 'stopped')),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  archived_at            TEXT,
  last_turn_at           TEXT,
  UNIQUE(agent_id, generation),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent
  ON agent_sessions(agent_id, status, generation DESC);

-- One active session per agent is a schema invariant, not just a
-- transaction discipline (specs/sessions.md).
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sessions_one_active
  ON agent_sessions(agent_id) WHERE status = 'active';

-- Seen ledger (specs/sessions.md): per-(session, chat) cursor of the highest
-- message sequence provably model-visible. Prompt catch-up and hold
-- envelopes advance it; notices and busy deliveries never do.
CREATE TABLE IF NOT EXISTS agent_session_chat_cursors (
  session_id     TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  seen_up_to_seq INTEGER NOT NULL DEFAULT 0 CHECK (seen_up_to_seq >= 0),
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (session_id, chat_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Server-served pull horizon, session-scoped like the seen ledger. This
-- supplements freshness hold decisions only; the session seen ledger remains
-- catch-up authority.
CREATE TABLE IF NOT EXISTS agent_session_served_cursors (
  session_id      TEXT NOT NULL,
  chat_id         TEXT NOT NULL,
  served_up_to_seq INTEGER NOT NULL DEFAULT 0 CHECK (served_up_to_seq >= 0),
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (session_id, chat_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_message_drafts (
  agent_id           TEXT NOT NULL,
  chat_id            TEXT NOT NULL,
  content            TEXT NOT NULL,
  attachment_ids_json TEXT NOT NULL DEFAULT '[]',
  rehold_count       INTEGER NOT NULL DEFAULT 0 CHECK (rehold_count >= 0),
  saved_at           TEXT NOT NULL,
  PRIMARY KEY (agent_id, chat_id),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

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

-- Per-turn workspace file-change evidence: the files a turn created, modified,
-- or deleted in the agent workspace, with bounded before/after text for diff
-- rendering. Filled by snapshot-compare when the turn settles; the summary
-- rides a workspace_changes activity row while contents load on demand.
CREATE TABLE IF NOT EXISTS agent_turn_file_changes (
  run_id      TEXT NOT NULL,
  path        TEXT NOT NULL,
  change      TEXT NOT NULL CHECK (change IN ('created', 'modified', 'deleted')),
  before_text TEXT,
  after_text  TEXT,
  omitted     TEXT CHECK (omitted IS NULL OR omitted IN ('binary', 'too-large')),
  before_size INTEGER,
  after_size  INTEGER,
  additions   INTEGER NOT NULL DEFAULT 0,
  deletions   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (run_id, path),
  FOREIGN KEY(run_id) REFERENCES agent_turns(id) ON DELETE CASCADE
);

-- Compact outcome signals for mention-dispatched turns: when a turn an agent
-- dispatched by mention settles, the requesting agent's seat receives one note
-- in its next prompt instead of polling transcripts.
CREATE TABLE IF NOT EXISTS agent_turn_outcome_notes (
  id                 TEXT PRIMARY KEY,
  turn_id            TEXT NOT NULL,
  recipient_agent_id TEXT NOT NULL,
  recipient_chat_id  TEXT NOT NULL,
  target_agent_id    TEXT NOT NULL,
  target_chat_id     TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'stopped', 'no_reply')),
  reply_message_id   TEXT,
  error              TEXT,
  created_at         TEXT NOT NULL,
  consumed_at        TEXT,
  consumed_by_run_id TEXT,
  FOREIGN KEY(turn_id) REFERENCES agent_turns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_turn_outcome_notes_recipient
  ON agent_turn_outcome_notes(recipient_agent_id, recipient_chat_id, consumed_at);

CREATE TABLE IF NOT EXISTS cron_jobs (
  id                   TEXT PRIMARY KEY,
  agent_id             TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  enabled              INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  schedule_json        TEXT NOT NULL,
  delivery_json        TEXT NOT NULL,
  payload_json         TEXT NOT NULL,
  delete_after_run     INTEGER NOT NULL DEFAULT 0 CHECK (delete_after_run IN (0, 1)),
  consecutive_errors   INTEGER,
  last_duration_ms     INTEGER,
  last_error_code      TEXT CHECK (last_error_code IS NULL OR last_error_code IN ('agent_not_found', 'execution_failed', 'control_plane_restarted')),
  last_error_message   TEXT,
  last_run_at_ms       INTEGER,
  last_run_status      TEXT CHECK (last_run_status IS NULL OR last_run_status IN ('queued', 'running', 'success', 'error', 'skipped')),
  next_run_at_ms       INTEGER,
  running_at_ms        INTEGER,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled_next_run
  ON cron_jobs(enabled, next_run_at_ms);

CREATE TABLE IF NOT EXISTS cron_runs (
  id                      TEXT PRIMARY KEY,
  job_id                  TEXT NOT NULL,
  chat_id                 TEXT,
  turn_id                 TEXT,
  trigger                 TEXT NOT NULL CHECK (trigger IN ('manual', 'recovery', 'schedule')),
  status                  TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'error', 'skipped')),
  scheduled_for           TEXT NOT NULL,
  started_at              TEXT,
  finished_at             TEXT,
  execution_error_code    TEXT CHECK (execution_error_code IS NULL OR execution_error_code IN ('agent_not_found', 'execution_failed', 'control_plane_restarted')),
  execution_error_message TEXT,
  quiet                   INTEGER NOT NULL DEFAULT 0 CHECK (quiet IN (0, 1)),
  script_exit_code        INTEGER,
  script_stderr           TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE SET NULL,
  FOREIGN KEY(turn_id) REFERENCES agent_turns(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_created
  ON cron_runs(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_runs_created
  ON cron_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id                TEXT PRIMARY KEY,
  number            INTEGER NOT NULL UNIQUE,
  kind              TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'epic')),
  title             TEXT NOT NULL,
  description       TEXT,
  summary           TEXT,
  blocked_reason_kind TEXT CHECK (blocked_reason_kind IS NULL OR blocked_reason_kind IN ('needs_input', 'error')),
  blocked_reason_message TEXT,
  status            TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in_progress', 'blocked', 'review', 'done', 'canceled')),
  priority          TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'urgent', 'high', 'medium', 'low')),
  assignee_kind     TEXT CHECK (assignee_kind IS NULL OR assignee_kind IN ('user', 'agent')),
  assignee_agent_id TEXT,
  epic_id           TEXT,
  scheduled_for     TEXT,
  origin_chat_id    TEXT,
  work_chat_id      TEXT,
  dispatch_trigger  TEXT CHECK (dispatch_trigger IS NULL OR dispatch_trigger IN ('manual', 'auto')),
  dispatch_attempts INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_attempts >= 0),
  active_dispatch_run_id TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY(epic_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(assignee_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_tasks_epic
  ON tasks(epic_id);

CREATE TABLE IF NOT EXISTS labels (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL CHECK (color IN ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink', 'gray')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_lower_name
  ON labels(lower(name));

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id            TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  PRIMARY KEY(task_id, depends_on_task_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on
  ON task_dependencies(depends_on_task_id);

CREATE TABLE IF NOT EXISTS task_labels (
  task_id  TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY(task_id, label_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(label_id) REFERENCES labels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_labels_label
  ON task_labels(label_id);

CREATE TABLE IF NOT EXISTS task_attachments (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  filename    TEXT NOT NULL,
  media_type  TEXT,
  byte_size   INTEGER NOT NULL CHECK (byte_size >= 0),
  source_path TEXT NOT NULL,
  promoted_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_attachments_task_filename
  ON task_attachments(task_id, lower(filename));

CREATE INDEX IF NOT EXISTS idx_task_attachments_task
  ON task_attachments(task_id);

CREATE TABLE IF NOT EXISTS memory_extraction_cursors (
  chat_id                  TEXT NOT NULL,
  agent_participant_id     TEXT NOT NULL,
  agent_id                 TEXT NOT NULL,
  last_extracted_sequence  INTEGER NOT NULL DEFAULT 0 CHECK (last_extracted_sequence >= 0),
  last_extracted_at        TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY(chat_id, agent_participant_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_extraction_cursors_agent
  ON memory_extraction_cursors(agent_id, updated_at);

CREATE TABLE IF NOT EXISTS memory_extraction_debounces (
  chat_id                  TEXT NOT NULL,
  agent_participant_id     TEXT NOT NULL,
  agent_id                 TEXT NOT NULL,
  pending_since            TEXT NOT NULL,
  last_activity_at         TEXT NOT NULL,
  scheduled_for            TEXT NOT NULL,
  target_sequence          INTEGER NOT NULL CHECK (target_sequence >= 0),
  attempts                 INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at               TEXT NOT NULL,
  PRIMARY KEY(chat_id, agent_participant_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_extraction_debounces_due
  ON memory_extraction_debounces(scheduled_for);

CREATE TABLE IF NOT EXISTS memory_jobs (
  id                     TEXT PRIMARY KEY,
  kind                   TEXT NOT NULL CHECK (kind IN ('extraction', 'dream', 'skill_review', 'curation')),
  status                 TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
  chat_id                TEXT,
  agent_id               TEXT NOT NULL,
  agent_participant_id   TEXT,
  model_category         TEXT CHECK (model_category IN ('fast', 'standard', 'deep', 'visual')),
  model_json             TEXT,
  source_start_sequence  INTEGER,
  source_end_sequence    INTEGER,
  output_path            TEXT,
  file_changes_json      TEXT NOT NULL DEFAULT '[]',
  usage_json             TEXT NOT NULL DEFAULT '{}',
  transcript_json        TEXT NOT NULL DEFAULT '[]',
  metadata_json          TEXT NOT NULL DEFAULT '{}',
  error                  TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  started_at             TEXT,
  completed_at           TEXT,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_agent_created
  ON memory_jobs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_status_due
  ON memory_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS skill_review_queue (
  agent_id              TEXT PRIMARY KEY,
  chat_id               TEXT NOT NULL,
  signals_json          TEXT NOT NULL DEFAULT '[]',
  window_start_sequence INTEGER,
  window_end_sequence   INTEGER,
  attempts              INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  scheduled_for         TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skill_review_queue_due
  ON skill_review_queue(scheduled_for);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                TEXT PRIMARY KEY,
  chat_id           TEXT NOT NULL,
  sequence          INTEGER NOT NULL,
  author_id         TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content           TEXT NOT NULL DEFAULT '',
  attachment_json   TEXT,
  nonce             TEXT,
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

CREATE INDEX IF NOT EXISTS idx_chat_responses_chat_active
  ON chat_responses(chat_id, status, response_message_id, deleted_at);

CREATE TABLE IF NOT EXISTS chat_response_activity (
  id             TEXT PRIMARY KEY,
  response_id    TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('reasoning', 'tool_call', 'tool_result', 'command', 'message', 'artifact', 'widget', 'custom')),
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

CREATE TABLE IF NOT EXISTS chat_pane_states (
  chat_id      TEXT PRIMARY KEY,
  revision     INTEGER NOT NULL,
  targets_json TEXT NOT NULL,
  active_key   TEXT,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_users (
  id            TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  name          TEXT,
  email         TEXT,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_members (
  user_id    TEXT PRIMARY KEY REFERENCES identity_users(id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_members_single_owner
  ON identity_members(role) WHERE role = 'owner';

CREATE TABLE IF NOT EXISTS identity_invites (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  created_by  TEXT NOT NULL REFERENCES identity_users(id),
  created_at  TEXT NOT NULL,
  redeemed_by TEXT REFERENCES identity_users(id),
  redeemed_at TEXT
);

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
        definition:
            "TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm', 'task', 'thread'))",
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'parent_chat_id',
        definition: 'TEXT',
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'anchor_message_id',
        definition: 'TEXT',
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'followed',
        definition: 'INTEGER NOT NULL DEFAULT 1 CHECK (followed IN (0, 1))',
        table: 'thread_follows',
    });
    db.exec(
        'CREATE INDEX IF NOT EXISTS idx_chats_parent ON chats(parent_chat_id) WHERE parent_chat_id IS NOT NULL'
    );
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
        column: 'usage_json',
        definition: "TEXT NOT NULL DEFAULT '{}'",
        table: 'memory_jobs',
    });
    ensureColumn(db, {
        column: 'transcript_json',
        definition: "TEXT NOT NULL DEFAULT '[]'",
        table: 'memory_jobs',
    });
    ensureColumn(db, {
        column: 'state',
        definition: "TEXT NOT NULL DEFAULT 'active'",
        table: 'skill_sources',
    });
    ensureColumn(db, {
        column: 'archived_at',
        definition: 'TEXT',
        table: 'skill_sources',
    });
    ensureColumn(db, {
        column: 'installed_hash',
        definition: 'TEXT',
        table: 'skill_sources',
    });
    ensureColumn(db, {
        column: 'summary',
        definition: 'TEXT',
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'blocked_reason_kind',
        definition:
            "TEXT CHECK (blocked_reason_kind IS NULL OR blocked_reason_kind IN ('needs_input', 'error'))",
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'blocked_reason_message',
        definition: 'TEXT',
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'scheduled_for',
        definition: 'TEXT',
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'origin_chat_id',
        definition: 'TEXT',
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'work_chat_id',
        definition: 'TEXT',
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'dispatch_trigger',
        definition:
            "TEXT CHECK (dispatch_trigger IS NULL OR dispatch_trigger IN ('manual', 'auto'))",
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'dispatch_attempts',
        definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_attempts >= 0)',
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'active_dispatch_run_id',
        definition: 'TEXT',
        table: 'tasks',
    });
    ensureColumn(db, {
        column: 'attempts',
        definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)',
        table: 'memory_extraction_debounces',
    });
    ensureColumn(db, {
        column: 'quiet',
        definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (quiet IN (0, 1))',
        table: 'cron_runs',
    });
    ensureColumn(db, {
        column: 'script_exit_code',
        definition: 'INTEGER',
        table: 'cron_runs',
    });
    ensureColumn(db, {
        column: 'script_stderr',
        definition: 'TEXT',
        table: 'cron_runs',
    });
}

function ensureColumn(
    db: Database,
    input: { column: string; definition: string; table: string }
): void {
    const rows = db.prepare(`PRAGMA table_info(${input.table})`).all() as Array<{
        name: string;
    }>;

    if (rows.some((row) => row.name === input.column)) {
        return;
    }

    db.exec(`ALTER TABLE ${input.table} ADD COLUMN ${input.column} ${input.definition}`);
}
