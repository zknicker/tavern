import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { namedParams } from '../db/sqlite';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { advanceChatIngestionCursor, listChatIngestionChats } from './chat-ingestion-cursor';
import { closeCortexDb, getCortexDb, initTestCortexDb } from './db';

describe('Cortex chat ingestion cursor selection', () => {
    beforeEach(async () => {
        const runtimeDb = initTestDb();
        ensureRuntimeSchema(runtimeDb);
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    });

    afterEach(async () => {
        closeDb();
        await closeCortexDb();
    });

    test('selects unprocessed chats after already processed older candidates', async () => {
        const runtimeDb = getDb();
        const cortexDb = getCortexDb();
        for (let index = 1; index <= 25; index += 1) {
            const chatId = `chat-${String(index).padStart(2, '0')}`;
            insertChat(runtimeDb, chatId, index);
            if (index <= 20) {
                await advanceChatIngestionCursor(cortexDb, {
                    chatId,
                    lastMessageId: `msg-${String(index).padStart(2, '0')}`,
                    lastSequence: 1,
                    sourceHash: `source-${index}`,
                });
            }
        }

        const chats = await listChatIngestionChats(runtimeDb, cortexDb);

        expect(chats.map((chat) => chat.chat_id)).toEqual([
            'chat-21',
            'chat-22',
            'chat-23',
            'chat-24',
            'chat-25',
        ]);
    });
});

function insertChat(runtimeDb: ReturnType<typeof getDb>, chatId: string, index: number) {
    const timestamp = `2026-06-05T00:${String(index).padStart(2, '0')}:00.000Z`;
    runtimeDb
        .prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ($id, $title, $timestamp, $timestamp, 1)`
        )
        .run(namedParams({ id: chatId, timestamp, title: `Chat ${index}` }));
    runtimeDb
        .prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ($id, $chatId, 1, 'user-1', 'user', $content, $timestamp, '{}')`
        )
        .run(
            namedParams({
                chatId,
                content: `Durable chat ingestion message ${index}.`,
                id: `msg-${String(index).padStart(2, '0')}`,
                timestamp,
            })
        );
}
