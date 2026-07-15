import type {
    TavernApiSchema,
    TavernChat,
    TavernCreateChatRequest,
    TavernListChatsResponse,
} from '@tavern/api';
import { getDb } from '../../db/connection.ts';
import type { Database } from '../../db/sqlite.ts';
import { namedParams, optionalRow } from '../../db/sqlite.ts';
import { assertTavernIdPrefix } from './ids.ts';
import { clampLimit } from './limits.ts';
import type { ChatRow, ParticipantRow } from './types.ts';

type ChatKind = TavernChat['kind'];
type ChatParticipant = TavernApiSchema<'Participant'>;

export function createChat(input: TavernCreateChatRequest, db: Database = getDb()): TavernChat {
    assertTavernIdPrefix(input.id, 'cht_', 'Chat id');
    const existing = getChat(input.id, db);
    if (existing) {
        const kind = input.kind ?? existing.kind;
        const participants = input.participants ?? existing.participants;
        validateChatShape({ kind, participants });
        const metadata = input.metadata ?? existing.metadata;
        const title = input.title ?? existing.title;
        const shouldTouch =
            kind !== existing.kind ||
            title !== existing.title ||
            JSON.stringify(participants) !== JSON.stringify(existing.participants) ||
            JSON.stringify(metadata) !== JSON.stringify(existing.metadata);
        const updatedAt = shouldTouch ? new Date().toISOString() : existing.updated_at;
        const transaction = db.transaction(() => {
            db.prepare(
                `UPDATE chats
                 SET kind = $kind,
                     title = $title,
                     metadata_json = $metadataJson,
                     updated_at = $updatedAt
                 WHERE id = $id`
            ).run(
                namedParams({
                    id: input.id,
                    kind,
                    metadataJson: JSON.stringify(metadata),
                    title,
                    updatedAt,
                })
            );
            if (input.participants) {
                replaceChatParticipants(input.id, input.participants, db);
            }
        });
        transaction();
        return getChatOrThrow(input.id, db);
    }

    const now = new Date().toISOString();
    const kind = input.kind ?? 'channel';
    const participants = input.participants ?? [];
    validateChatShape({ kind, participants });
    const transaction = db.transaction(() => {
        db.prepare(
            `INSERT INTO chats (id, kind, title, pinned, metadata_json, created_at, updated_at)
             VALUES ($id, $kind, $title, $pinned, $metadataJson, $now, $now)`
        ).run(
            namedParams({
                id: input.id,
                kind,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                now,
                pinned: 0,
                title: input.title ?? null,
            })
        );
        replaceChatParticipants(input.id, participants, db);
    });
    transaction();
    return getChatOrThrow(input.id, db);
}

export function listChats(
    input: { cursor?: string | null; limit?: number } = {},
    db: Database = getDb()
): TavernListChatsResponse {
    const limit = clampLimit(input.limit);
    const rows = db
        .prepare(
            `SELECT chats.*,
                    (
                        SELECT MAX(chat_messages.created_at)
                        FROM chat_messages
                        WHERE chat_messages.chat_id = chats.id
                          AND chat_messages.deleted_at IS NULL
                    ) AS last_activity_at,
                    (
                        SELECT json_group_array(DISTINCT chat_responses.participant_id)
                        FROM chat_responses
                        WHERE chat_responses.chat_id = chats.id
                          AND chat_responses.deleted_at IS NULL
                          AND chat_responses.status IN ('queued', 'running')
                          AND chat_responses.response_message_id IS NULL
                    ) AS active_turn_participant_ids
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
        chats: rows.map((row) => rowToChat(row, db)),
        next_cursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
}

/** Chats where the given agent participant holds a seat, oldest id first. */
export function listChatsForAgentParticipant(
    participantId: string,
    db: Database = getDb()
): TavernChat[] {
    const rows = db
        .prepare(
            `SELECT chats.*,
                    NULL AS last_activity_at,
                    NULL AS active_turn_participant_ids
             FROM chats
             JOIN chat_participants ON chat_participants.chat_id = chats.id
             WHERE chat_participants.id = $participantId
               AND chat_participants.kind = 'agent'
             ORDER BY chats.id ASC`
        )
        .all(namedParams({ participantId })) as ChatRow[];
    return rows.map((row) => rowToChat(row, db));
}

export function getChat(id: string, db: Database = getDb()): TavernChat | null {
    const row = optionalRow(
        db
            .prepare(
                `SELECT chats.*,
                    (
                        SELECT MAX(chat_messages.created_at)
                        FROM chat_messages
                        WHERE chat_messages.chat_id = chats.id
                          AND chat_messages.deleted_at IS NULL
                    ) AS last_activity_at,
                    (
                        SELECT json_group_array(DISTINCT chat_responses.participant_id)
                        FROM chat_responses
                        WHERE chat_responses.chat_id = chats.id
                          AND chat_responses.deleted_at IS NULL
                          AND chat_responses.status IN ('queued', 'running')
                          AND chat_responses.response_message_id IS NULL
                    ) AS active_turn_participant_ids
             FROM chats
             WHERE id = $id`
            )
            .get(namedParams({ id })) as ChatRow | null
    );
    return row ? rowToChat(row, db) : null;
}

export function assertChatExists(chatId: string, db: Database) {
    if (!getChat(chatId, db)) {
        throw new Error(`Chat ${chatId} does not exist.`);
    }
}

export function setChatArchived(
    input: { archived: boolean; chatId: string },
    db: Database = getDb()
): TavernChat | null {
    const chat = getChat(input.chatId, db);
    if (!chat) {
        return null;
    }

    const tavern =
        typeof chat.metadata.tavern === 'object' && chat.metadata.tavern !== null
            ? (chat.metadata.tavern as Record<string, unknown>)
            : {};

    return createChat(
        {
            id: input.chatId,
            metadata: {
                ...chat.metadata,
                tavern: {
                    ...tavern,
                    archived: input.archived,
                },
            },
            title: chat.title,
        },
        db
    );
}

export function getChatOrThrow(id: string, db: Database): TavernChat {
    const chat = getChat(id, db);
    if (!chat) {
        throw new Error(`Missing chat ${id}.`);
    }
    return chat;
}

function rowToChat(row: ChatRow, db: Database): TavernChat {
    return {
        active_turn_participant_ids: parseActiveTurnParticipantIds(row.active_turn_participant_ids),
        created_at: row.created_at,
        id: row.id,
        kind: row.kind,
        last_activity_at: row.last_activity_at,
        last_message_sequence: row.last_message_sequence,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        participants: listChatParticipants(row.id, db),
        title: row.title,
        updated_at: row.updated_at,
    };
}

function parseActiveTurnParticipantIds(value: string | null): string[] {
    if (!value) {
        return [];
    }

    const parsed = JSON.parse(value) as unknown;
    if (
        !Array.isArray(parsed) ||
        parsed.some((participantId) => typeof participantId !== 'string')
    ) {
        throw new Error('Invalid active_turn_participant_ids JSON.');
    }

    return [...parsed].sort();
}

function listChatParticipants(chatId: string, db: Database = getDb()): ChatParticipant[] {
    const rows = db
        .prepare(
            `SELECT chat_id, id, kind, label, metadata_json
             FROM chat_participants
             WHERE chat_id = $chatId
             ORDER BY id ASC`
        )
        .all(namedParams({ chatId })) as ParticipantRow[];

    return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        label: row.label,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    }));
}

function replaceChatParticipants(chatId: string, participants: ChatParticipant[], db: Database) {
    const seen = new Set<string>();
    for (const participant of participants) {
        if (seen.has(participant.id)) {
            throw new Error(`Duplicate participant ${participant.id} in chat ${chatId}.`);
        }
        seen.add(participant.id);
        db.prepare(
            `INSERT INTO chat_participants (
                chat_id,
                id,
                kind,
                label,
                metadata_json
             )
             VALUES (
                $chatId,
                $id,
                $kind,
                $label,
                $metadataJson
             )` +
                ` ON CONFLICT(chat_id, id) DO UPDATE SET
                kind = excluded.kind,
                label = excluded.label,
                metadata_json = excluded.metadata_json`
        ).run(
            namedParams({
                chatId,
                id: participant.id,
                kind: participant.kind,
                label: participant.label,
                metadataJson: JSON.stringify(participant.metadata ?? {}),
            })
        );
    }

    if (seen.size === 0) {
        db.prepare('DELETE FROM chat_participants WHERE chat_id = $chatId').run(
            namedParams({ chatId })
        );
        return;
    }

    const placeholders = [...seen].map(() => '?').join(', ');
    db.prepare(
        `DELETE FROM chat_participants WHERE chat_id = ? AND id NOT IN (${placeholders})`
    ).run(chatId, ...seen);
}

function validateChatShape(input: { kind: ChatKind; participants: ChatParticipant[] }) {
    if (input.kind !== 'dm') {
        return;
    }

    if (input.participants.length !== 2) {
        throw new Error('A DM chat must have exactly two participants.');
    }
}
