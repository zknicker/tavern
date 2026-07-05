import type { Database } from './sqlite';

const CHAT_RESPONSE_ACTIVITY_TABLE = `
CREATE TABLE chat_response_activity (
  id             TEXT PRIMARY KEY,
  response_id    TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('reasoning', 'tool_call', 'tool_result', 'command', 'message', 'artifact', 'rich_response', 'custom')),
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

export function repairRuntimeSchema(db: Database): void {
    ensureChatResponseActivityRichResponseKind(db);
    hydrateAgentSkillAssignments(db);
}

function ensureChatResponseActivityRichResponseKind(db: Database): void {
    const sql = tableSql(db, 'chat_response_activity');

    if (!sql || (sql.includes("'rich_response'") && !sql.includes("'widget'"))) {
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
  WHERE kind <> 'widget';
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

function tableSql(db: Database, name: string): string | null {
    const row = db
        .prepare('SELECT sql FROM sqlite_master WHERE type = $type AND name = $name')
        .get({ $name: name, $type: 'table' }) as { sql: string } | null;

    return row?.sql ?? null;
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
