import type { TavernChatEvent, TavernMarkReadRequest } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { insertEvent, publish, replaceEventPayload } from './events';
import { assertTavernIdPrefix } from './ids';
import { latestMessageSequence } from './messages';
import type { ReadReceipt, ReadRow } from './types';

export function markRead(
    chatId: string,
    input: TavernMarkReadRequest,
    db: Database = getDb()
): ReadReceipt {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(input.reader_id, 'usr_', 'Read reader id');
    // Omitted sequence means read-to-latest, resolved at write time so the
    // caller cannot race a message that lands while the request is in flight.
    const lastReadSequence = input.last_read_sequence ?? latestMessageSequence(chatId, db);
    const existing = optionalRow(
        db
            .prepare('SELECT * FROM chat_reads WHERE chat_id = $chatId AND reader_id = $readerId')
            .get(namedParams({ chatId, readerId: input.reader_id })) as ReadRow | null
    );
    if (existing && existing.last_read_sequence >= lastReadSequence) {
        return rowToReadReceipt(existing);
    }

    db.exec('BEGIN IMMEDIATE');
    try {
        const readAt = new Date().toISOString();
        const event = insertEvent(
            {
                chatId,
                event: 'chat.read',
                private: true,
                recipients: [input.reader_id],
                payload: {
                    read: {
                        chat_id: chatId,
                        cursor: '0',
                        last_read_sequence: lastReadSequence,
                        read_at: readAt,
                        reader_id: input.reader_id,
                    },
                },
            },
            db
        );
        db.prepare(
            `INSERT INTO chat_reads (chat_id, reader_id, last_read_sequence, read_at, cursor)
             VALUES ($chatId, $readerId, $lastReadSequence, $readAt, $cursor)
             ON CONFLICT(chat_id, reader_id) DO UPDATE SET
               last_read_sequence = excluded.last_read_sequence,
               read_at = excluded.read_at,
               cursor = excluded.cursor`
        ).run(
            namedParams({
                chatId,
                cursor: Number(event.cursor),
                lastReadSequence,
                readAt,
                readerId: input.reader_id,
            })
        );
        const receipt = getReadReceiptOrThrow(chatId, input.reader_id, db);
        replaceEventPayload(event.cursor, { read: receipt }, db);
        db.exec('COMMIT');
        publish({ ...event, read: receipt } as TavernChatEvent);
        return receipt;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function getReadReceiptOrThrow(chatId: string, readerId: string, db: Database): ReadReceipt {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_reads WHERE chat_id = $chatId AND reader_id = $readerId')
            .get(namedParams({ chatId, readerId })) as ReadRow | null
    );
    if (!row) {
        throw new Error(`Missing read receipt ${chatId}/${readerId}.`);
    }
    return rowToReadReceipt(row);
}

function rowToReadReceipt(row: ReadRow): ReadReceipt {
    return {
        chat_id: row.chat_id,
        cursor: String(row.cursor),
        last_read_sequence: row.last_read_sequence,
        read_at: row.read_at,
        reader_id: row.reader_id,
    };
}
