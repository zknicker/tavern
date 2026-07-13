import type { TavernChatEvent, TavernCreateDeliveryRequest } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { insertEvent, publish, replaceEventPayload } from './events';
import { assertOptionalTavernIdPrefix, assertTavernIdPrefix } from './ids';
import { findExistingMessage, getMessage, getMessageOrThrow, insertMessage } from './messages';
import type { DeliveryReceipt, DeliveryRow } from './types';

export function createDelivery(
    chatId: string,
    input: TavernCreateDeliveryRequest,
    db: Database = getDb()
): DeliveryReceipt {
    assertDeliveryInputIds(chatId, input);
    const existing = optionalRow(
        db
            .prepare('SELECT * FROM chat_deliveries WHERE id = $id')
            .get(namedParams({ id: input.id })) as DeliveryRow | null
    );
    if (existing) {
        return {
            cursor: String(existing.cursor),
            id: existing.id,
            idempotent: true,
            message: getMessageOrThrow(existing.message_id, db),
        };
    }

    db.exec('BEGIN IMMEDIATE');
    try {
        // A streaming post created at first content links here; the delivery
        // finalizes its text and metadata in place (specs/chat-timeline.md).
        const message =
            finalizeExistingMessage(chatId, input.message, db) ??
            insertMessage(chatId, input.message, input.agent_id, input.id, db);
        const now = new Date().toISOString();
        const event = insertEvent(
            {
                chatId,
                event: 'message.delivered',
                payload: {
                    delivery: {
                        cursor: '0',
                        id: input.id,
                        idempotent: false,
                        message,
                    },
                },
            },
            db
        );
        db.prepare(
            `INSERT INTO chat_deliveries
             (id, chat_id, agent_id, turn_id, message_id, cursor, metadata_json, created_at)
             VALUES ($id, $chatId, $agentId, $turnId, $messageId, $cursor, $metadataJson, $now)`
        ).run(
            namedParams({
                agentId: input.agent_id,
                chatId,
                cursor: Number(event.cursor),
                id: input.id,
                messageId: message.id,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                now,
                turnId: input.turn_id ?? null,
            })
        );
        const receipt = { cursor: event.cursor, id: input.id, idempotent: false, message };
        replaceEventPayload(event.cursor, { delivery: receipt }, db);
        db.exec('COMMIT');
        publish({ ...event, delivery: receipt } as TavernChatEvent);
        return receipt;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

/** Messages a turn delivered, oldest first, with the chat each landed in. */
export function listDeliveriesForTurn(
    turnId: string,
    db: Database = getDb()
): Array<{ chatId: string; messageId: string }> {
    const rows = db
        .prepare(
            `SELECT chat_id, message_id
             FROM chat_deliveries
             WHERE turn_id = $turnId
             ORDER BY cursor ASC`
        )
        .all(namedParams({ turnId })) as Array<{ chat_id: string; message_id: string }>;
    return rows.map((row) => ({ chatId: row.chat_id, messageId: row.message_id }));
}

// The delivery's message may already exist as the turn's streaming post
// (same id): settle its final content and metadata inside the delivery
// transaction while keeping its sequence — the post never moves.
function finalizeExistingMessage(
    chatId: string,
    input: TavernCreateDeliveryRequest['message'],
    db: Database
) {
    const byId = getMessage(input.id, db);

    if (byId && isStreamingPost(byId, chatId, input)) {
        // Metadata always settles — the delivery clears the streaming flag
        // even when the last streamed edit already matched the final text.
        db.prepare(
            'UPDATE chat_messages SET content = $content, metadata_json = $metadataJson WHERE id = $id'
        ).run(
            namedParams({
                content: input.content,
                id: byId.id,
                metadataJson: JSON.stringify(input.metadata ?? {}),
            })
        );

        return getMessageOrThrow(byId.id, db);
    }

    // Not a streaming post: normal idempotency rules apply (same content or
    // conflict).
    return findExistingMessage(chatId, input, db);
}

function isStreamingPost(
    existing: ReturnType<typeof getMessage> & object,
    chatId: string,
    input: TavernCreateDeliveryRequest['message']
) {
    const runtime = existing.metadata?.runtime;
    const streaming =
        runtime && typeof runtime === 'object' && !Array.isArray(runtime)
            ? (runtime as Record<string, unknown>).streaming === true
            : false;

    return (
        streaming &&
        existing.chat_id === chatId &&
        existing.author.id === input.author_id &&
        existing.role === input.role
    );
}

function assertDeliveryInputIds(chatId: string, input: TavernCreateDeliveryRequest) {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(input.id, 'del_', 'Delivery id');
    assertTavernIdPrefix(input.agent_id, 'agt_', 'Delivery agent id');
    assertOptionalTavernIdPrefix(input.turn_id, 'run_', 'Delivery turn id');
}
