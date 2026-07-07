import type { TavernClearChatReceipt, TavernDeleteResponseReceipt } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams } from '../../db/sqlite';
import { assertChatExists } from './chats';
import { insertEvent, publish } from './events';
import { assertTavernIdPrefix } from './ids';
import { getResponse } from './responses';

/**
 * Timeline dismissal: soft-deletes keep rows and sequence slots but drop them
 * from the product timeline. deleteResponse dismisses one response (and its
 * activity) — used for failed turns. clearChat dismisses everything currently
 * in a chat — a Chat API primitive for external clients.
 */
export function deleteResponse(id: string, db: Database = getDb()): TavernDeleteResponseReceipt {
    assertTavernIdPrefix(id, 'rsp_', 'Response id');
    const response = getResponse(id, db);
    if (!response) {
        throw new Error(`Missing chat response ${id}.`);
    }

    const deletedAt = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('UPDATE chat_responses SET deleted_at = $deletedAt WHERE id = $id').run(
            namedParams({ deletedAt, id })
        );
        const event = insertEvent(
            {
                chatId: response.chat_id,
                event: 'response.deleted',
                payload: { response_id: id },
            },
            db
        );
        db.exec('COMMIT');
        publish(event);
        return { cursor: event.cursor, deleted_at: deletedAt, response_id: id };
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

export function clearChat(chatId: string, db: Database = getDb()): TavernClearChatReceipt {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    const clearedAt = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
        assertChatExists(chatId, db);
        const messages = db
            .prepare(
                `UPDATE chat_messages
                 SET deleted_at = $clearedAt
                 WHERE chat_id = $chatId AND deleted_at IS NULL`
            )
            .run(namedParams({ chatId, clearedAt }));
        const responses = db
            .prepare(
                `UPDATE chat_responses
                 SET deleted_at = $clearedAt
                 WHERE chat_id = $chatId AND deleted_at IS NULL`
            )
            .run(namedParams({ chatId, clearedAt }));
        const event = insertEvent(
            { chatId, event: 'chat.cleared', payload: { cleared_at: clearedAt } },
            db
        );
        db.exec('COMMIT');
        publish(event);
        return {
            chat_id: chatId,
            cleared_at: clearedAt,
            cursor: event.cursor,
            messages_deleted: Number(messages.changes),
            responses_deleted: Number(responses.changes),
        };
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
