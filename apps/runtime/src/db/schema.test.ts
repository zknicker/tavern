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
});

function createLegacyResponseActivityTable(db: Database) {
    db.exec(`
CREATE TABLE chat_response_activity (
  id             TEXT PRIMARY KEY,
  response_id    TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('planning', 'reasoning', 'tool_call', 'tool_result', 'command', 'approval', 'message', 'artifact', 'widget', 'custom')),
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

function tableSql(db: Database, name: string) {
    const row = db
        .prepare('SELECT sql FROM sqlite_master WHERE type = $type AND name = $name')
        .get({ $name: name, $type: 'table' }) as { sql: string } | null;

    return row?.sql ?? '';
}
