import type { TavernChat, TavernCreateChatRequest, TavernListChatsResponse } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { assertTavernIdPrefix } from './ids';
import { clampLimit } from './limits';
import type { ChatRow } from './types';

export function createChat(input: TavernCreateChatRequest, db: Database = getDb()): TavernChat {
    assertTavernIdPrefix(input.id, 'cht_', 'Chat id');
    const existing = getChat(input.id, db);
    if (existing) {
        return existing;
    }

    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO chats (id, title, metadata_json, created_at, updated_at)
         VALUES ($id, $title, $metadataJson, $now, $now)`
    ).run(
        namedParams({
            id: input.id,
            metadataJson: JSON.stringify(input.metadata ?? {}),
            now,
            title: input.title ?? null,
        })
    );
    return getChatOrThrow(input.id, db);
}

export function listChats(
    input: { cursor?: string | null; limit?: number } = {},
    db: Database = getDb()
): TavernListChatsResponse {
    const limit = clampLimit(input.limit);
    const rows = db
        .prepare(
            `SELECT *
             FROM chats
             WHERE id > $cursor
             ORDER BY id ASC
             LIMIT $limit`
        )
        .all(
            namedParams({
                cursor: input.cursor ?? '',
                limit,
            })
        ) as ChatRow[];
    return {
        chats: rows.map(rowToChat),
        next_cursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
}

export function getChat(id: string, db: Database = getDb()): TavernChat | null {
    const row = optionalRow(
        db.prepare('SELECT * FROM chats WHERE id = $id').get(namedParams({ id })) as ChatRow | null
    );
    return row ? rowToChat(row) : null;
}

export function assertChatExists(chatId: string, db: Database) {
    if (!getChat(chatId, db)) {
        throw new Error(`Chat ${chatId} does not exist.`);
    }
}

export function getChatOrThrow(id: string, db: Database): TavernChat {
    const chat = getChat(id, db);
    if (!chat) {
        throw new Error(`Missing chat ${id}.`);
    }
    return chat;
}

function rowToChat(row: ChatRow): TavernChat {
    return {
        created_at: row.created_at,
        id: row.id,
        last_message_sequence: row.last_message_sequence,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        title: row.title,
        updated_at: row.updated_at,
    };
}
