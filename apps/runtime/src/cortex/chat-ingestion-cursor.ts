import type { CortexSourceRef } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { sourceRefFromChatMessage } from './chat-source-ref';
import type { CortexDatabase } from './db';
import { nowIso, readJsonRecord } from './rows';

const maxChatsPerRun = 5;
const maxMessagesPerChat = 20;
const maxBatchChars = 12_000;

export interface ChatIngestionChatRow {
    chat_id: string;
    last_processed_sequence: number;
    title: string;
}

export interface ChatIngestionMessageRow {
    author_id: string;
    chat_id: string;
    content: string;
    created_at: string;
    id: string;
    role: 'assistant' | 'system' | 'user';
    sequence: number;
}

export async function listChatIngestionChats(
    runtimeDb: Database,
    cortexDb: CortexDatabase
): Promise<ChatIngestionChatRow[]> {
    const rows = runtimeDb
        .prepare(
            `SELECT c.id AS chat_id,
                    COALESCE(c.title, c.id) AS title,
                    MIN(m.created_at) AS oldest_unprocessed_at
             FROM chats c
             JOIN chat_messages m ON m.chat_id = c.id
             WHERE m.deleted_at IS NULL
               AND m.content != ''
             GROUP BY c.id, c.title
             ORDER BY oldest_unprocessed_at ASC`
        )
        .all() as Array<{
        chat_id: string;
        title: string;
    }>;
    const chats: ChatIngestionChatRow[] = [];
    for (const row of rows) {
        const cursor = await getChatIngestionCursor(cortexDb, row.chat_id);
        const hasUnprocessed = runtimeDb
            .prepare(
                `SELECT 1
                 FROM chat_messages
                 WHERE chat_id = $chatId
                   AND deleted_at IS NULL
                   AND content != ''
                   AND sequence > $lastSequence
                 LIMIT 1`
            )
            .get(
                namedParams({
                    chatId: row.chat_id,
                    lastSequence: cursor.last_processed_sequence,
                })
            );
        if (hasUnprocessed) {
            chats.push({
                chat_id: row.chat_id,
                last_processed_sequence: cursor.last_processed_sequence,
                title: row.title,
            });
        }
        if (chats.length >= maxChatsPerRun) {
            break;
        }
    }
    return chats;
}

export function listChatIngestionMessages(
    db: Database,
    chat: ChatIngestionChatRow
): ChatIngestionMessageRow[] {
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
        ) as ChatIngestionMessageRow[];

    let usedChars = 0;
    const bounded: ChatIngestionMessageRow[] = [];
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

export function advanceChatIngestionCursor(
    db: CortexDatabase,
    input: {
        chatId: string;
        lastMessageId: string;
        lastProcessedAt?: string;
        lastSequence: number;
        sourceHash: string | null;
    }
): Promise<void> {
    return db
        .prepare(
            `INSERT INTO cortex_chat_ingestion_cursors
         (chat_id, last_processed_sequence, last_processed_message_id, last_processed_at, last_source_hash, updated_at)
         VALUES ($chatId, $sequence, $messageId, $processedAt, $sourceHash, $updatedAt)
         ON CONFLICT(chat_id) DO UPDATE SET
           last_processed_sequence = excluded.last_processed_sequence,
           last_processed_message_id = excluded.last_processed_message_id,
           last_processed_at = excluded.last_processed_at,
           last_source_hash = excluded.last_source_hash,
           updated_at = excluded.updated_at`
        )
        .run({
            chatId: input.chatId,
            messageId: input.lastMessageId,
            processedAt: input.lastProcessedAt ?? nowIso(),
            sequence: input.lastSequence,
            sourceHash: input.sourceHash,
            updatedAt: nowIso(),
        });
}

export async function findChatIngestionReviewAudit(
    db: CortexDatabase,
    sourceHash: string
): Promise<string | null> {
    const rows = await db
        .prepare(
            `SELECT id, metadata_json
             FROM cortex_audit_events
             WHERE kind = 'chat_ingestion.review'
               AND status = 'success'
             ORDER BY created_at DESC
             LIMIT 200`
        )
        .all<{ id: string; metadata_json: string }>();
    for (const row of rows) {
        if (readJsonRecord(row.metadata_json).sourceHash === sourceHash) {
            return row.id;
        }
    }
    return null;
}

async function getChatIngestionCursor(
    db: CortexDatabase,
    chatId: string
): Promise<{ last_processed_sequence: number }> {
    return (
        (await db
            .prepare(
                `SELECT last_processed_sequence
                 FROM cortex_chat_ingestion_cursors
                 WHERE chat_id = ?
                 LIMIT 1`
            )
            .get<{ last_processed_sequence: number }>(chatId)) ?? {
            last_processed_sequence: 0,
        }
    );
}

export function sourceRefFromMessage(row: ChatIngestionMessageRow): CortexSourceRef {
    return sourceRefFromChatMessage(row);
}

export function isOperationalMessage(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    return /^(ok|okay|thanks|thank you|yep|yeah|sure|sgtm|sounds good|do it|go ahead|cool)[.!]*$/u.test(
        normalized
    );
}
