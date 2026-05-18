import type {
    TavernChatActivity,
    TavernListChatActivityResponse,
    TavernUpdateActivityRequest,
} from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { insertEvent, publish } from './events';
import { assertTavernIdPrefix } from './ids';
import type { ActivityRow } from './types';

export function listActivity(db: Database = getDb()): TavernListChatActivityResponse {
    const rows = db
        .prepare('SELECT * FROM chat_activity ORDER BY updated_at DESC, chat_id ASC')
        .all() as ActivityRow[];

    return {
        activities: rows.map(rowToActivity),
    };
}

export function updateActivity(
    chatId: string,
    input: TavernUpdateActivityRequest,
    db: Database = getDb()
): TavernChatActivity {
    assertActivityInputIds(chatId, input);
    db.exec('BEGIN IMMEDIATE');
    try {
        const now = new Date().toISOString();
        db.prepare(
            `INSERT INTO chat_activity
             (chat_id, run_id, agent_id, status, summary, steps_json, metadata_json, updated_at)
             VALUES ($chatId, $runId, $agentId, $status, $summary, $stepsJson, $metadataJson, $now)
             ON CONFLICT(chat_id) DO UPDATE SET
               run_id = excluded.run_id,
               agent_id = excluded.agent_id,
               status = excluded.status,
               summary = excluded.summary,
               steps_json = excluded.steps_json,
               metadata_json = excluded.metadata_json,
               updated_at = excluded.updated_at`
        ).run(
            namedParams({
                agentId: input.agent_id,
                chatId,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                now,
                runId: input.run_id,
                status: input.status,
                stepsJson: JSON.stringify(input.steps ?? []),
                summary: input.summary ?? null,
            })
        );
        const activity = getActivityOrThrow(chatId, db);
        const event = insertEvent(
            {
                chatId,
                event:
                    input.status === 'completed'
                        ? 'chat.activity.completed'
                        : input.status === 'failed'
                          ? 'chat.activity.failed'
                          : 'chat.activity.updated',
                payload: { activity },
            },
            db
        );
        db.exec('COMMIT');
        publish(event);
        return activity;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function assertActivityInputIds(chatId: string, input: TavernUpdateActivityRequest) {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(input.run_id, 'run_', 'Activity run id');
    assertTavernIdPrefix(input.agent_id, 'agt_', 'Activity agent id');
}

function getActivityOrThrow(chatId: string, db: Database): TavernChatActivity {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_activity WHERE chat_id = $chatId')
            .get(namedParams({ chatId })) as ActivityRow | null
    );
    if (!row) {
        throw new Error(`Missing chat activity ${chatId}.`);
    }
    return rowToActivity(row);
}

function rowToActivity(row: ActivityRow): TavernChatActivity {
    return {
        agent_id: row.agent_id,
        chat_id: row.chat_id,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        run_id: row.run_id,
        status: row.status,
        steps: JSON.parse(row.steps_json) as TavernChatActivity['steps'],
        summary: row.summary,
        updated_at: row.updated_at,
    };
}
