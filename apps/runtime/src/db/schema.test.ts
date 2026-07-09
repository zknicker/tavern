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

    it('repairs response activity kind constraints to allow widget activity', () => {
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
            $kind: 'rich_response',
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
                id: 'act_widget',
                kind: 'widget',
                status: 'completed',
                title: 'Widget',
            })
        ).not.toThrow();
        expect(getResponseActivity('act_widget')).toMatchObject({
            id: 'act_widget',
            kind: 'widget',
        });
        expect(tableSql(db, 'chat_response_activity')).toContain("'widget'");
        expect(tableSql(db, 'chat_response_activity')).not.toContain("'rich_response'");
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

    it('repairs chat kind constraints to allow task chats', () => {
        const db = initTestDb();
        createLegacyChatsTable(db);

        ensureRuntimeSchema(db);
        createChat({ id: 'cht_task', kind: 'task', title: 'T-1: Fix it' });

        expect(tableSql(db, 'chats')).toContain("'task'");
        expect(db.prepare("SELECT kind FROM chats WHERE id = 'cht_task'").get()).toEqual({
            kind: 'task',
        });
    });

    it('migrates legacy task labels into records and repairs task constraints', () => {
        const db = initTestDb();
        createLegacyTasksTable(db);
        db.exec('PRAGMA foreign_keys = OFF');
        db.prepare(
            `INSERT INTO tasks (
                id, number, kind, title, description, status, priority,
                labels_json, created_at, updated_at
             )
             VALUES (
                'tsk_old', 1, 'task', 'Old task', 'Keep this row', 'todo',
                'high', '["legacy", "Shared"]', '2026-07-02T20:00:00.000Z',
                '2026-07-02T20:00:00.000Z'
             )`
        ).run();
        db.prepare(
            `INSERT INTO tasks (
                id, number, kind, title, description, status, priority,
                labels_json, created_at, updated_at
             )
             VALUES (
                'tsk_other', 2, 'task', 'Other task', NULL, 'todo',
                'none', '["shared", "Bug"]', '2026-07-02T20:00:00.000Z',
                '2026-07-02T20:00:00.000Z'
             )`
        ).run();
        db.exec('PRAGMA foreign_keys = ON');

        ensureRuntimeSchema(db);
        db.prepare(
            `INSERT INTO tasks (
                id, number, kind, title, status, priority, created_at, updated_at
             )
             VALUES (
                'tsk_blocked', 3, 'task', 'Blocked task', 'blocked',
                'none', '2026-07-02T20:01:00.000Z',
                '2026-07-02T20:01:00.000Z'
             )`
        ).run();

        expect(tableSql(db, 'tasks')).toContain("'review'");
        expect(tableSql(db, 'tasks')).not.toContain('labels_json');
        expect(
            db
                .prepare(
                    `SELECT id, status, title, description, origin_chat_id, scheduled_for
                     FROM tasks ORDER BY number`
                )
                .all()
        ).toEqual([
            {
                description: 'Keep this row',
                id: 'tsk_old',
                origin_chat_id: null,
                scheduled_for: null,
                status: 'todo',
                title: 'Old task',
            },
            {
                description: null,
                id: 'tsk_other',
                origin_chat_id: null,
                scheduled_for: null,
                status: 'todo',
                title: 'Other task',
            },
            {
                description: null,
                id: 'tsk_blocked',
                origin_chat_id: null,
                scheduled_for: null,
                status: 'blocked',
                title: 'Blocked task',
            },
        ]);
        expect(
            db.prepare('SELECT id, name, color FROM labels ORDER BY lower(name)').all()
        ).toMatchObject([{ name: 'Bug' }, { name: 'legacy' }, { name: 'Shared' }]);
        expect(
            db
                .prepare(
                    `SELECT t.id AS task_id, l.name
                     FROM task_labels tl
                     JOIN tasks t ON t.id = tl.task_id
                     JOIN labels l ON l.id = tl.label_id
                     ORDER BY t.number, lower(l.name)`
                )
                .all()
        ).toEqual([
            { name: 'legacy', task_id: 'tsk_old' },
            { name: 'Shared', task_id: 'tsk_old' },
            { name: 'Bug', task_id: 'tsk_other' },
            { name: 'Shared', task_id: 'tsk_other' },
        ]);
        expect(tableSql(db, 'task_dependencies')).toContain('depends_on_task_id');
    });
});

function createLegacyResponseActivityTable(db: Database) {
    db.exec(`
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

function createLegacyChatsTable(db: Database) {
    db.exec(`
CREATE TABLE chats (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm')),
  title                 TEXT,
  pinned                INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0
);
`);
}

function createLegacyTasksTable(db: Database) {
    db.exec(`
CREATE TABLE tasks (
  id                TEXT PRIMARY KEY,
  number            INTEGER NOT NULL UNIQUE,
  kind              TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'epic')),
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'canceled')),
  priority          TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'urgent', 'high', 'medium', 'low')),
  assignee_kind     TEXT CHECK (assignee_kind IS NULL OR assignee_kind IN ('user', 'agent')),
  assignee_agent_id TEXT,
  epic_id           TEXT,
  labels_json       TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY(epic_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(assignee_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_tasks_epic
  ON tasks(epic_id);
`);
}

function tableSql(db: Database, name: string) {
    const row = db
        .prepare('SELECT sql FROM sqlite_master WHERE type = $type AND name = $name')
        .get({ $name: name, $type: 'table' }) as { sql: string } | null;

    return row?.sql ?? '';
}
