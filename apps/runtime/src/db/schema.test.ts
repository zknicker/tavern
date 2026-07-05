import { afterEach, describe, expect, it } from 'vitest';
import {
    createChat,
    getResponseActivity,
    upsertResponse,
    upsertResponseActivity,
} from '../tavern/chat-api';
import { closeDb, initTestDb } from './connection';
import { ensureRuntimeSchema } from './schema';
import type { Database } from './sqlite';

describe('Runtime DB schema repairs', () => {
    afterEach(() => {
        closeDb();
    });

    it('repairs response activity kind constraints to allow rich response activity', () => {
        const db = initTestDb();
        createLegacyResponseActivityTable(db);
        db.exec('PRAGMA foreign_keys = OFF');
        db.prepare(
            `INSERT INTO chat_response_activity
             (id, response_id, chat_id, sequence, kind, status, title, artifact_ids_json,
              metadata_json, started_at, updated_at)
             VALUES ($id, $responseId, $chatId, $sequence, $kind, 'completed', $title,
              '[]', '{}', $now, $now)`
        ).run({
            $chatId: 'cht_old',
            $id: 'act_retired',
            $kind: 'widget',
            $now: new Date().toISOString(),
            $responseId: 'rsp_old',
            $sequence: 1,
            $title: 'Retired display',
        });
        db.exec('PRAGMA foreign_keys = ON');

        ensureRuntimeSchema(db);
        createChat({ id: 'cht_legacy' });
        upsertResponse('cht_legacy', {
            id: 'rsp_legacy',
            participant_id: 'agt_1',
            status: 'running',
        });

        expect(() =>
            upsertResponseActivity('cht_legacy', 'rsp_legacy', {
                id: 'act_rich_response',
                kind: 'rich_response',
                status: 'completed',
                title: 'Rich Response',
            })
        ).not.toThrow();
        expect(getResponseActivity('act_rich_response')).toMatchObject({
            id: 'act_rich_response',
            kind: 'rich_response',
        });
        expect(tableSql(db, 'chat_response_activity')).toContain("'rich_response'");
        expect(tableSql(db, 'chat_response_activity')).not.toContain("'widget'");
        expect(
            db
                .prepare(
                    "SELECT COUNT(*) AS count FROM chat_response_activity WHERE id = 'act_retired'"
                )
                .get()
        ).toMatchObject({ count: 0 });
    });

    it('repairs memory job kind constraints to allow skill review jobs', () => {
        const db = initTestDb();
        createLegacyMemoryJobsTable(db);
        db.exec('PRAGMA foreign_keys = OFF');
        db.prepare(
            `INSERT INTO memory_jobs (
                id, kind, status, agent_id, file_changes_json, usage_json,
                transcript_json, metadata_json, created_at, updated_at
             )
             VALUES (
                'memjob_old', 'extraction', 'completed', 'agt_1', '[]', '{}',
                '[]', '{"kept":true}', '2026-07-02T20:00:00.000Z',
                '2026-07-02T20:00:00.000Z'
             )`
        ).run();
        db.exec('PRAGMA foreign_keys = ON');

        ensureRuntimeSchema(db);
        db.prepare(
            `INSERT INTO memory_jobs (
                id, kind, status, agent_id, file_changes_json, usage_json,
                transcript_json, metadata_json, created_at, updated_at
             )
             VALUES (
                'memjob_review', 'skill_review', 'completed', 'agt_1', '[]', '{}',
                '[]', '{}', '2026-07-02T20:01:00.000Z',
                '2026-07-02T20:01:00.000Z'
             )`
        ).run();

        expect(tableSql(db, 'memory_jobs')).toContain("'skill_review'");
        expect(tableSql(db, 'memory_jobs')).toContain("'curation'");
        expect(
            db.prepare('SELECT id, kind, metadata_json FROM memory_jobs ORDER BY id ASC').all()
        ).toEqual([
            {
                id: 'memjob_old',
                kind: 'extraction',
                metadata_json: '{"kept":true}',
            },
            {
                id: 'memjob_review',
                kind: 'skill_review',
                metadata_json: '{}',
            },
        ]);
    });
});

function createLegacyResponseActivityTable(db: Database) {
    db.exec(`
CREATE TABLE chat_response_activity (
  id             TEXT PRIMARY KEY,
  response_id    TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('planning', 'reasoning', 'tool_call', 'tool_result', 'command', 'message', 'artifact', 'widget', 'custom')),
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
`);
}

function createLegacyMemoryJobsTable(db: Database) {
    db.exec(`
CREATE TABLE memory_jobs (
  id                     TEXT PRIMARY KEY,
  kind                   TEXT NOT NULL CHECK (kind IN ('extraction', 'dream')),
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
`);
}

function tableSql(db: Database, name: string) {
    const row = db
        .prepare('SELECT sql FROM sqlite_master WHERE type = $type AND name = $name')
        .get({ $name: name, $type: 'table' }) as { sql: string } | null;

    return row?.sql ?? '';
}
