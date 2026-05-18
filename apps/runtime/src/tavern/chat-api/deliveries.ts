import type { TavernChatEvent, TavernCreateDeliveryRequest } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams, optionalRow } from '../../db/sqlite';
import { insertEvent, publish, replaceEventPayload } from './events';
import { assertOptionalTavernIdPrefix, assertTavernIdPrefix } from './ids';
import { findExistingMessage, getMessageOrThrow, insertMessage } from './messages';
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
        const message =
            findExistingMessage(chatId, input.message, db) ??
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

function assertDeliveryInputIds(chatId: string, input: TavernCreateDeliveryRequest) {
    assertTavernIdPrefix(chatId, 'cht_', 'Chat id');
    assertTavernIdPrefix(input.id, 'del_', 'Delivery id');
    assertTavernIdPrefix(input.agent_id, 'agt_', 'Delivery agent id');
    assertOptionalTavernIdPrefix(input.turn_id, 'run_', 'Delivery turn id');
}
