import type {
    TavernChatMessage,
    TavernCreateMessageRequest,
    TavernListMessagesResponse,
} from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { assertChatExists } from './chats';
import { currentCursor, insertEvent, publish } from './events';
import { assertOptionalTavernIdPrefix, assertTavernIdPrefix } from './ids';
import { clampLimit } from './limits';
import type { DeleteReceipt, MessageReceipt, MessageRow, ParticipantRow } from './types';

export function createMessage(
    chatId: string,
    input: TavernCreateMessageRequest,
    db: Database = getDb()
): MessageReceipt {
    assertMessageInputIds(chatId, input);
    const existing = findExistingMessage(chatId, input, db);
    if (existing) {
        return { cursor: currentCursor(db), idempotent: true, message: existing };
    }

    db.exec('BEGIN IMMEDIATE');
    try {
        const message = insertMessage(chatId, input, input.author_id, null, db);
        const event = insertEvent({ chatId, event: 'message.created', payload: { message } }, db);
        db.exec('COMMIT');
        publish(event);
        return { cursor: event.cursor, idempotent: false, message };
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

export function listMessages(
    chatId: string,
    input: { afterSequence?: number; beforeSequence?: number; limit?: number } = {},
    db: Database = getDb()
): TavernListMessagesResponse {
    const limit = clampLimit(input.limit);
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_messages
             WHERE chat_id = $chatId
               AND sequence > $afterSequence
               AND ($beforeSequence IS NULL OR sequence < $beforeSequence)
             ORDER BY sequence ASC
             LIMIT $limit`
        )
        .all(
            namedParams({
                afterSequence: input.afterSequence ?? 0,
                beforeSequence: input.beforeSequence ?? null,
                chatId,
                limit,
            })
        ) as MessageRow[];
    return {
        messages: rows.map((row) => rowToMessage(row, db)),
        next_sequence: rows.length === limit ? (rows.at(-1)?.sequence ?? 0) + 1 : null,
    };
}

export function listRecentMessagesBefore(
    chatId: string,
    input: { beforeSequence: number; limit?: number },
    db: Database = getDb()
): TavernChatMessage[] {
    const limit = clampLimit(input.limit);
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_messages
             WHERE chat_id = $chatId
               AND sequence < $beforeSequence
             ORDER BY sequence DESC
             LIMIT $limit`
        )
        .all(
            namedParams({
                beforeSequence: input.beforeSequence,
                chatId,
                limit,
            })
        ) as MessageRow[];

    return rows.reverse().map((row) => rowToMessage(row, db));
}

export function searchMessages(
    chatId: string,
    input: { limit?: number; query: string },
    db: Database = getDb()
): TavernListMessagesResponse {
    const query = input.query.trim();
    if (!query) {
        throw new Error('Message search query is required.');
    }

    const limit = clampLimit(input.limit);
    const rows = db
        .prepare(
            `SELECT *
             FROM chat_messages
             WHERE chat_id = $chatId
               AND instr(lower(content), lower($query)) > 0
             ORDER BY sequence DESC
             LIMIT $limit`
        )
        .all(
            namedParams({
                chatId,
                limit,
                query,
            })
        ) as MessageRow[];

    return {
        messages: rows.map((row) => rowToMessage(row, db)),
        next_sequence: null,
    };
}

export function getMessage(id: string, db: Database = getDb()): TavernChatMessage | null {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_messages WHERE id = $id')
            .get(namedParams({ id })) as MessageRow | null
    );
    return row ? rowToMessage(row, db) : null;
}

export function deleteMessage(id: string, db: Database = getDb()): DeleteReceipt {
    assertTavernIdPrefix(id, 'msg_', 'Message id');
    const message = getMessageOrThrow(id, db);
    const deletedAt = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('UPDATE chat_messages SET deleted_at = $deletedAt WHERE id = $id').run(
            namedParams({ deletedAt, id })
        );
        const event = insertEvent(
            {
                chatId: message.chat_id,
                event: 'message.deleted',
                payload: { message_id: id },
            },
            db
        );
        db.exec('COMMIT');
        publish(event);
        return { cursor: event.cursor, deleted_at: deletedAt, message_id: id };
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

export function insertMessage(
    chatId: string,
    input: TavernCreateMessageRequest,
    authorId: string,
    deliveryId: string | null,
    db: Database
): TavernChatMessage {
    assertMessageInputIds(chatId, input);
    assertChatExists(chatId, db);
    upsertParticipant(chatId, authorId, input.role, db);
    const sequence = nextMessageSequence(chatId, db);
    const createdAt = new Date().toISOString();
    db.prepare(
        `INSERT INTO chat_messages
         (id, chat_id, sequence, author_id, role, content, attachment_json, nonce, parent_message_id,
          thread_root_id, delivery_id, created_at, metadata_json)
         VALUES ($id, $chatId, $sequence, $authorId, $role, $content, $attachmentJson, $nonce,
          $parentMessageId, $threadRootId, $deliveryId, $createdAt, $metadataJson)`
    ).run(
        namedParams({
            attachmentJson:
                input.attachments === undefined || input.attachments.length === 0
                    ? null
                    : JSON.stringify(input.attachments),
            authorId,
            chatId,
            content: input.content,
            createdAt,
            deliveryId,
            id: input.id,
            metadataJson: JSON.stringify(input.metadata ?? {}),
            nonce: input.nonce ?? null,
            parentMessageId: input.parent_message_id ?? null,
            role: input.role,
            sequence,
            threadRootId: input.thread_root_id ?? null,
        })
    );
    db.prepare(
        `UPDATE chats
         SET last_message_sequence = $sequence, updated_at = $createdAt
         WHERE id = $chatId`
    ).run(namedParams({ chatId, createdAt, sequence }));
    return getMessageOrThrow(input.id, db);
}

export function getMessageOrThrow(id: string, db: Database): TavernChatMessage {
    const message = getMessage(id, db);
    if (!message) {
        throw new Error(`Missing message ${id}.`);
    }
    return message;
}

export function findExistingMessage(
    chatId: string,
    input: TavernCreateMessageRequest,
    db: Database
): TavernChatMessage | null {
    const byId = getMessage(input.id, db);
    if (byId) {
        assertSameMessage(chatId, input, byId);
        return byId;
    }
    if (!input.nonce) {
        return null;
    }
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_messages WHERE chat_id = $chatId AND nonce = $nonce')
            .get(namedParams({ chatId, nonce: input.nonce })) as MessageRow | null
    );
    if (!row) {
        return null;
    }
    const message = rowToMessage(row, db);
    assertSameMessage(chatId, input, message);
    return message;
}

export function rowToMessage(row: MessageRow, db: Database): TavernChatMessage {
    const author = getParticipant(row.chat_id, row.author_id, db);
    return {
        attachments: parseStoredAttachments(row.attachment_json),
        author,
        chat_id: row.chat_id,
        content: row.content,
        created_at: row.created_at,
        deleted_at: row.deleted_at,
        delivery_id: row.delivery_id,
        id: row.id,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        nonce: row.nonce,
        parent_message_id: row.parent_message_id,
        role: row.role,
        sequence: row.sequence,
        thread_root_id: row.thread_root_id,
    };
}

function assertMessageInputIds(chatId: string, input: TavernCreateMessageRequest) {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(input.id, 'msg_', 'Message id');
    assertTavernIdPrefix(input.author_id, authorPrefix(input.role), 'Author id');
    assertOptionalTavernIdPrefix(input.parent_message_id, 'msg_', 'Parent message id');
    assertOptionalTavernIdPrefix(input.thread_root_id, 'msg_', 'Thread root message id');
}

function authorPrefix(role: TavernChatMessage['role']) {
    if (role === 'assistant') {
        return 'agt_';
    }
    if (role === 'system') {
        return 'sys_';
    }
    return 'usr_';
}

function getParticipant(chatId: string, id: string, db: Database): TavernChatMessage['author'] {
    const row = optionalRow(
        db
            .prepare('SELECT * FROM chat_participants WHERE chat_id = $chatId AND id = $id')
            .get(namedParams({ chatId, id })) as ParticipantRow | null
    );
    if (!row) {
        throw new Error(`Missing participant ${id}.`);
    }
    return {
        id: row.id,
        kind: row.kind,
        label: row.label,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    };
}

function upsertParticipant(
    chatId: string,
    id: string,
    role: TavernChatMessage['role'],
    db: Database
) {
    db.prepare(
        `INSERT INTO chat_participants (chat_id, id, kind, label, metadata_json)
         VALUES ($chatId, $id, $kind, NULL, '{}')
         ON CONFLICT(chat_id, id) DO UPDATE SET kind = excluded.kind`
    ).run(namedParams({ chatId, id, kind: roleToParticipantKind(role) }));
}

function roleToParticipantKind(role: TavernChatMessage['role']) {
    if (role === 'assistant') {
        return 'agent';
    }
    return role;
}

function assertSameMessage(
    chatId: string,
    input: TavernCreateMessageRequest,
    existing: TavernChatMessage
) {
    if (
        existing.chat_id !== chatId ||
        existing.author.id !== input.author_id ||
        existing.role !== input.role ||
        existing.content !== input.content ||
        JSON.stringify(existing.attachments) !== JSON.stringify(input.attachments ?? [])
    ) {
        throw new Error('Tavern message id or nonce was already used for a different message.');
    }
}

function parseStoredAttachments(value: string | null): Record<string, unknown>[] {
    if (!value) {
        return [];
    }

    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
        return parsed.filter(
            (entry): entry is Record<string, unknown> =>
                Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
        );
    }

    if (parsed && typeof parsed === 'object') {
        return [parsed as Record<string, unknown>];
    }

    return [];
}

function nextMessageSequence(chatId: string, db: Database) {
    const row = db
        .prepare('SELECT last_message_sequence FROM chats WHERE id = $chatId')
        .get(namedParams({ chatId })) as { last_message_sequence: number } | null;
    if (!row) {
        throw new Error(`Chat ${chatId} does not exist.`);
    }
    return row.last_message_sequence + 1;
}
