import type { Database } from './sqlite';

const CHAT_RESPONSE_ACTIVITY_TABLE = `
CREATE TABLE chat_response_activity (
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
)`;

const CHAT_RESPONSE_ACTIVITY_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_chat_response_activity_response_sequence
  ON chat_response_activity(response_id, sequence);

CREATE INDEX IF NOT EXISTS idx_chat_response_activity_chat_sequence
  ON chat_response_activity(chat_id, sequence);
`;

const MEMORY_JOBS_TABLE = `
CREATE TABLE memory_jobs (
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
)`;

const MEMORY_JOBS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_memory_jobs_agent_created
  ON memory_jobs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_status_due
  ON memory_jobs(status, created_at);
`;

const SKILL_SOURCES_TABLE = `
CREATE TABLE skill_sources (
  skill_id            TEXT PRIMARY KEY,
  source              TEXT NOT NULL CHECK (source IN ('seeded', 'hub', 'agent', 'external', 'plugin')),
  state               TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'stale', 'archived')),
  created_by_agent_id TEXT,
  installed_hash      TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT
)`;

const TASKS_TABLE = `
CREATE TABLE tasks (
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
  labels_json       TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY(epic_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(assignee_agent_id) REFERENCES agents(id) ON DELETE SET NULL
)`;

const TASKS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_tasks_epic
  ON tasks(epic_id);
`;

export function repairRuntimeSchema(db: Database): void {
    ensureChatResponseActivityWidgetKind(db);
    ensureMemoryJobsSkillReviewKind(db);
    ensureSkillSourcesPluginSource(db);
    ensureTasksBlockedAndReviewStatus(db);
    hydrateAgentSkillAssignments(db);
}

function ensureChatResponseActivityWidgetKind(db: Database): void {
    const sql = tableSql(db, 'chat_response_activity');

    if (!sql || (sql.includes("'widget'") && !sql.includes("'rich_response'"))) {
        return;
    }

    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.chat_response_activity_rebuild;
CREATE TEMP TABLE chat_response_activity_rebuild AS
  SELECT id, response_id, chat_id, sequence, kind, status, title, detail, summary,
         artifact_ids_json, metadata_json, started_at, updated_at, completed_at
  FROM chat_response_activity;
DROP TABLE chat_response_activity;
${CHAT_RESPONSE_ACTIVITY_TABLE};
INSERT INTO chat_response_activity
  (id, response_id, chat_id, sequence, kind, status, title, detail, summary,
   artifact_ids_json, metadata_json, started_at, updated_at, completed_at)
  SELECT id, response_id, chat_id, sequence,
         kind, status, title, detail, summary,
         artifact_ids_json, metadata_json, started_at, updated_at, completed_at
  FROM chat_response_activity_rebuild
  WHERE kind <> 'rich_response';
DROP TABLE temp.chat_response_activity_rebuild;
${CHAT_RESPONSE_ACTIVITY_INDEXES}
`);
        db.exec('COMMIT');
        transactionOpen = false;
    } catch (error) {
        if (transactionOpen) {
            db.exec('ROLLBACK');
        }
        throw error;
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}

function ensureMemoryJobsSkillReviewKind(db: Database): void {
    const sql = tableSql(db, 'memory_jobs');

    if (!sql || sql.includes("'skill_review'")) {
        return;
    }

    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.memory_jobs_rebuild;
CREATE TEMP TABLE memory_jobs_rebuild AS
  SELECT id, kind, status, chat_id, agent_id, agent_participant_id,
         model_category, model_json, source_start_sequence, source_end_sequence,
         output_path, file_changes_json, usage_json, transcript_json,
         metadata_json, error, created_at, updated_at, started_at, completed_at
  FROM memory_jobs;
DROP TABLE memory_jobs;
${MEMORY_JOBS_TABLE};
INSERT INTO memory_jobs
  (id, kind, status, chat_id, agent_id, agent_participant_id,
   model_category, model_json, source_start_sequence, source_end_sequence,
   output_path, file_changes_json, usage_json, transcript_json,
   metadata_json, error, created_at, updated_at, started_at, completed_at)
  SELECT id, kind, status, chat_id, agent_id, agent_participant_id,
         model_category, model_json, source_start_sequence, source_end_sequence,
         output_path, file_changes_json, usage_json, transcript_json,
         metadata_json, error, created_at, updated_at, started_at, completed_at
  FROM memory_jobs_rebuild;
DROP TABLE temp.memory_jobs_rebuild;
${MEMORY_JOBS_INDEXES}
`);
        db.exec('COMMIT');
        transactionOpen = false;
    } catch (error) {
        if (transactionOpen) {
            db.exec('ROLLBACK');
        }
        throw error;
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}

function ensureSkillSourcesPluginSource(db: Database): void {
    const sql = tableSql(db, 'skill_sources');

    if (!sql || sql.includes("'plugin'")) {
        return;
    }
    ensureTableColumn(db, {
        column: 'state',
        definition: "TEXT NOT NULL DEFAULT 'active'",
        table: 'skill_sources',
    });
    ensureTableColumn(db, {
        column: 'installed_hash',
        definition: 'TEXT',
        table: 'skill_sources',
    });
    ensureTableColumn(db, {
        column: 'archived_at',
        definition: 'TEXT',
        table: 'skill_sources',
    });

    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.skill_sources_rebuild;
CREATE TEMP TABLE skill_sources_rebuild AS
  SELECT skill_id, source, state, created_by_agent_id, installed_hash,
         created_at, updated_at, archived_at
  FROM skill_sources;
DROP TABLE skill_sources;
${SKILL_SOURCES_TABLE};
INSERT INTO skill_sources
  (skill_id, source, state, created_by_agent_id, installed_hash,
   created_at, updated_at, archived_at)
  SELECT skill_id, source, state, created_by_agent_id, installed_hash,
         created_at, updated_at, archived_at
  FROM skill_sources_rebuild;
DROP TABLE temp.skill_sources_rebuild;
`);
        db.exec('COMMIT');
        transactionOpen = false;
    } catch (error) {
        if (transactionOpen) {
            db.exec('ROLLBACK');
        }
        throw error;
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}

function ensureTasksBlockedAndReviewStatus(db: Database): void {
    const sql = tableSql(db, 'tasks');

    if (!sql || sql.includes("'review'")) {
        return;
    }

    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.tasks_rebuild;
CREATE TEMP TABLE tasks_rebuild AS
  SELECT id, number, kind, title, description, NULL AS summary,
         NULL AS blocked_reason_kind, NULL AS blocked_reason_message,
         status, priority, assignee_kind, assignee_agent_id, epic_id,
         labels_json, created_at, updated_at
  FROM tasks;
DROP TABLE tasks;
${TASKS_TABLE};
INSERT INTO tasks
  (id, number, kind, title, description, summary, blocked_reason_kind,
   blocked_reason_message, status, priority, assignee_kind, assignee_agent_id,
   epic_id, labels_json, created_at, updated_at)
  SELECT id, number, kind, title, description, summary, blocked_reason_kind,
         blocked_reason_message, status, priority, assignee_kind,
         assignee_agent_id, epic_id, labels_json, created_at, updated_at
  FROM tasks_rebuild;
DROP TABLE temp.tasks_rebuild;
${TASKS_INDEXES}
`);
        db.exec('COMMIT');
        transactionOpen = false;
    } catch (error) {
        if (transactionOpen) {
            db.exec('ROLLBACK');
        }
        throw error;
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}

function tableSql(db: Database, name: string): string | null {
    const row = db
        .prepare('SELECT sql FROM sqlite_master WHERE type = $type AND name = $name')
        .get({ $name: name, $type: 'table' }) as { sql: string } | null;

    return row?.sql ?? null;
}

function ensureTableColumn(
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

function hydrateAgentSkillAssignments(db: Database): void {
    if (!(tableSql(db, 'agents') && tableSql(db, 'agent_skill_assignments'))) {
        return;
    }

    const now = new Date().toISOString();
    const rows = db
        .prepare(
            `SELECT id, enabled_skill_ids_json
             FROM agents
             WHERE id NOT IN (
               SELECT DISTINCT agent_id FROM agent_skill_assignments
             )`
        )
        .all() as Array<{ enabled_skill_ids_json: string; id: string }>;

    const insert = db.prepare(
        `INSERT OR IGNORE INTO agent_skill_assignments
         (agent_id, skill_id, enabled, created_at, updated_at)
         VALUES ($agentId, $skillId, 1, $now, $now)`
    );

    for (const row of rows) {
        for (const skillId of parseStringArray(row.enabled_skill_ids_json)) {
            insert.run({ $agentId: row.id, $now: now, $skillId: skillId });
        }
    }
}

function parseStringArray(value: string): string[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
            return parsed.filter((entry): entry is string => typeof entry === 'string');
        }
    } catch {
        return [];
    }

    return [];
}
