import type { TavernChatMessage } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams } from '../../db/sqlite';
import { insertEvent, publish } from './events';
import { getMessage, getMessageOrThrow } from './messages';

// Message reactions: one row per (message, actor, emoji). Toggling emits a
// message.updated event so every surface refreshes the enriched message.

export class ReactionError extends Error {
    readonly code: 'MESSAGE_NOT_FOUND';

    constructor(code: ReactionError['code'], message: string) {
        super(message);
        this.code = code;
    }
}

export function setMessageReaction(
    input: { actorId: string; emoji: string; messageId: string; remove?: boolean },
    db: Database = getDb()
): TavernChatMessage {
    const message = getMessage(input.messageId, db);
    if (!message || message.deleted_at) {
        throw new ReactionError('MESSAGE_NOT_FOUND', 'That message does not exist.');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
        if (input.remove) {
            db.prepare(
                `DELETE FROM message_reactions
                 WHERE message_id = $messageId AND actor_id = $actorId AND emoji = $emoji`
            ).run(
                namedParams({
                    actorId: input.actorId,
                    emoji: input.emoji,
                    messageId: input.messageId,
                })
            );
        } else {
            db.prepare(
                `INSERT OR IGNORE INTO message_reactions (message_id, actor_id, emoji, created_at)
                 VALUES ($messageId, $actorId, $emoji, $now)`
            ).run(
                namedParams({
                    actorId: input.actorId,
                    emoji: input.emoji,
                    messageId: input.messageId,
                    now: new Date().toISOString(),
                })
            );
        }
        const updated = getMessageOrThrow(input.messageId, db);
        const event = insertEvent(
            { chatId: message.chat_id, event: 'message.updated', payload: { message: updated } },
            db
        );
        db.exec('COMMIT');
        publish(event);
        return updated;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
