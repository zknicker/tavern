import type { TavernMessageReaction, TavernMessageTask, TavernTaskActor } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams } from '../../db/sqlite';
import { getStoredAgent } from '../agents-store.ts';
import { labelsByIds } from './labels';

// Read-side task/reaction annotations for chat messages. This module works
// on raw rows only (no messages.ts import) so message reads can enrich rows
// without an import cycle through the mutation stores.

export type TaskStatus = TavernMessageTask['status'];
export type TaskPriority = TavernMessageTask['priority'];

export interface MessageTaskRow {
    assignee_id: string | null;
    chat_id: string;
    claimed_at: string | null;
    created_at: string;
    created_by: string;
    label_ids_json: string;
    message_id: string;
    number: number;
    origin: 'composed' | 'converted';
    priority: TaskPriority;
    status: TaskStatus;
    updated_at: string;
}

export function taskRowForMessage(messageId: string, db: Database): MessageTaskRow | null {
    return (
        (db
            .prepare('SELECT * FROM message_tasks WHERE message_id = $messageId')
            .get(namedParams({ messageId })) as MessageTaskRow | null) ?? null
    );
}

export function taskRowForNumber(
    chatId: string,
    number: number,
    db: Database
): MessageTaskRow | null {
    return (
        (db
            .prepare('SELECT * FROM message_tasks WHERE chat_id = $chatId AND number = $number')
            .get(namedParams({ chatId, number })) as MessageTaskRow | null) ?? null
    );
}

export function rowToTask(row: MessageTaskRow, db: Database): TavernMessageTask {
    return {
        assignee: row.assignee_id ? taskActor(row.assignee_id, db) : null,
        claimed_at: row.claimed_at,
        created_at: row.created_at,
        labels: labelsByIds(parseLabelIds(row.label_ids_json), db),
        number: row.number,
        origin: row.origin,
        priority: row.priority,
        status: row.status,
        updated_at: row.updated_at,
    };
}

export function taskForMessage(
    messageId: string,
    db: Database = getDb()
): TavernMessageTask | null {
    const row = taskRowForMessage(messageId, db);
    return row ? rowToTask(row, db) : null;
}

export function reactionsForMessage(
    messageId: string,
    db: Database = getDb()
): TavernMessageReaction[] {
    const rows = db
        .prepare(
            `SELECT emoji, actor_id FROM message_reactions
             WHERE message_id = $messageId
             ORDER BY rowid`
        )
        .all(namedParams({ messageId })) as Array<{ actor_id: string; emoji: string }>;
    const byEmoji = new Map<string, string[]>();
    for (const row of rows) {
        const actors = byEmoji.get(row.emoji) ?? [];
        actors.push(row.actor_id);
        byEmoji.set(row.emoji, actors);
    }
    return [...byEmoji.entries()].map(([emoji, actorIds]) => ({
        actors: actorIds.map((id) => taskActor(id, db)),
        emoji,
    }));
}

export function taskActor(id: string, db: Database = getDb()): TavernTaskActor {
    return { handle: actorHandle(id, db), id };
}

export function actorHandleText(id: string, db: Database): string {
    const handle = actorHandle(id, db);
    return handle ? `@${handle}` : id;
}

function actorHandle(id: string, db: Database): string | null {
    const agent = getStoredAgent(id, db);
    if (agent) {
        return agent.name;
    }
    const user = db
        .prepare('SELECT name FROM identity_users WHERE id = $id')
        .get(namedParams({ id })) as { name: string | null } | null;
    return user?.name ?? null;
}

function parseLabelIds(value: string): string[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed)
            ? parsed.filter((entry): entry is string => typeof entry === 'string')
            : [];
    } catch {
        return [];
    }
}
