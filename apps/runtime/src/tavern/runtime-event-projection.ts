import type { AgentRuntimeEvent, TavernChatEvent, TavernChatMessage } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { listEvents } from './chat-api';

// Projects durable chat events into the runtime event feed the server
// consumes. Post-flip (ADR 0014) the conversation is durable messages only:
// message and read events project; the retired response/activity event
// shapes from pre-flip databases are skipped rather than bricking catch-up.

export interface PersistedRuntimeEvent {
    cursor: number;
    event: AgentRuntimeEvent;
}

export function listProjectedTavernRuntimeEvents(
    options: { afterCursor?: number; limit?: number } = {},
    db?: Database
): PersistedRuntimeEvent[] {
    const afterCursor = options.afterCursor ?? 0;
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 500);
    return listEvents({ afterCursor: String(afterCursor), limit }, db).events.flatMap((event) =>
        chatEventToRuntimeEvents(event)
    );
}

function chatEventToRuntimeEvents(event: TavernChatEvent): PersistedRuntimeEvent[] {
    switch (event.type) {
        case 'message.created': {
            const runtimeEvent = messageCreatedToRuntimeEvent(event.message, event.created_at);
            return runtimeEvent ? [{ cursor: Number(event.cursor), event: runtimeEvent }] : [];
        }
        case 'chat.read':
            return [
                {
                    cursor: Number(event.cursor),
                    event: {
                        chatId: event.chat_id,
                        lastReadSequence: event.read.last_read_sequence,
                        readerId: event.read.reader_id,
                        timestamp: event.created_at,
                        type: 'chat.read',
                    },
                },
            ];
        case 'chat.cleared':
        case 'message.updated':
            return [
                {
                    cursor: Number(event.cursor),
                    event: {
                        chatId: event.chat_id,
                        timestamp: event.created_at,
                        type: 'chat.historyChanged',
                    },
                },
            ];
        default:
            // Retired pre-flip event shapes (response.*, activity.*,
            // message.delivered, message.deleted, artifact.created) may
            // remain in upgraded databases; they no longer project.
            return [];
    }
}

function messageCreatedToRuntimeEvent(
    message: TavernChatMessage,
    timestamp: string
): AgentRuntimeEvent | null {
    // Agent sends and system receipts refresh the visible history; human
    // messages carry the accepted-message payload the app's optimistic rows
    // reconcile against.
    if (message.role !== 'user') {
        return {
            chatId: message.chat_id,
            timestamp,
            type: 'chat.historyChanged',
        };
    }

    return {
        chatId: message.chat_id,
        message: {
            id: message.id,
            nonce: message.nonce ?? undefined,
            senderId: message.author.id,
            senderName: message.author.label ?? message.author.id,
            sequence: message.sequence,
            text: message.content,
            timestamp: message.created_at,
        },
        timestamp,
        type: 'chat.messageAccepted',
    };
}
