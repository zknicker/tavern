import type { CortexSourceRef } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { sourceRefFromChatMessage } from './chat-source-ref';
import { nowIso, readJsonRecord } from './rows';

const maxChatsPerRun = 5;
const maxMessagesPerChat = 20;
const maxBatchChars = 12_000;

export interface SignalChatRow {
    chat_id: string;
    last_processed_sequence: number;
    title: string;
}

export interface SignalMessageRow {
    author_id: string;
    chat_id: string;
    content: string;
    created_at: string;
    id: string;
    role: 'assistant' | 'system' | 'user';
    sequence: number;
}

export function listSignalChats(db: Database): SignalChatRow[] {
    return db
        .prepare(
            `SELECT c.id AS chat_id,
                    COALESCE(c.title, c.id) AS title,
                    COALESCE(cur.last_processed_sequence, 0) AS last_processed_sequence,
                    MIN(m.created_at) AS oldest_unprocessed_at
             FROM chats c
             JOIN chat_messages m ON m.chat_id = c.id
             LEFT JOIN cortex_signal_cursors cur ON cur.chat_id = c.id
             WHERE m.deleted_at IS NULL
               AND m.content != ''
               AND m.sequence > COALESCE(cur.last_processed_sequence, 0)
             GROUP BY c.id, c.title, cur.last_processed_sequence
             ORDER BY oldest_unprocessed_at ASC
             LIMIT $limit`
        )
        .all(namedParams({ limit: maxChatsPerRun })) as SignalChatRow[];
}

export function listSignalMessages(db: Database, chat: SignalChatRow): SignalMessageRow[] {
    const rows = db
        .prepare(
            `SELECT id, chat_id, sequence, author_id, role, content, created_at
             FROM chat_messages
             WHERE chat_id = $chatId
               AND deleted_at IS NULL
               AND content != ''
               AND sequence > $lastSequence
             ORDER BY sequence ASC
             LIMIT $limit`
        )
        .all(
            namedParams({
                chatId: chat.chat_id,
                lastSequence: chat.last_processed_sequence,
                limit: maxMessagesPerChat,
            })
        ) as SignalMessageRow[];

    let usedChars = 0;
    const bounded: SignalMessageRow[] = [];
    for (const row of rows) {
        const nextChars = row.content.length;
        if (bounded.length > 0 && usedChars + nextChars > maxBatchChars) {
            break;
        }
        usedChars += nextChars;
        bounded.push(row);
    }
    return bounded;
}

export function advanceSignalCursor(
    db: Database,
    input: {
        chatId: string;
        lastMessageId: string;
        lastProcessedAt?: string;
        lastSequence: number;
        sourceHash: string | null;
    }
): void {
    db.prepare(
        `INSERT INTO cortex_signal_cursors
         (chat_id, last_processed_sequence, last_processed_message_id, last_processed_at, last_source_hash, updated_at)
         VALUES ($chatId, $sequence, $messageId, $processedAt, $sourceHash, $updatedAt)
         ON CONFLICT(chat_id) DO UPDATE SET
           last_processed_sequence = excluded.last_processed_sequence,
           last_processed_message_id = excluded.last_processed_message_id,
           last_processed_at = excluded.last_processed_at,
           last_source_hash = excluded.last_source_hash,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            chatId: input.chatId,
            messageId: input.lastMessageId,
            processedAt: input.lastProcessedAt ?? nowIso(),
            sequence: input.lastSequence,
            sourceHash: input.sourceHash,
            updatedAt: nowIso(),
        })
    );
}

export function findSignalReviewAudit(db: Database, sourceHash: string): string | null {
    const rows = db
        .prepare(
            `SELECT id, metadata_json
             FROM cortex_audit_events
             WHERE kind = 'signal.review'
               AND status = 'success'
             ORDER BY created_at DESC
             LIMIT 200`
        )
        .all() as Array<{ id: string; metadata_json: string }>;
    for (const row of rows) {
        if (readJsonRecord(row.metadata_json).sourceHash === sourceHash) {
            return row.id;
        }
    }
    return null;
}

export function sourceRefFromMessage(row: SignalMessageRow): CortexSourceRef {
    return sourceRefFromChatMessage(row);
}

export function isOperationalMessage(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    return /^(ok|okay|thanks|thank you|yep|yeah|sure|sgtm|sounds good|do it|go ahead|cool)[.!]*$/u.test(
        normalized
    );
}
