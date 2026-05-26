import type {
    AgentRuntimeEvent,
    TavernChatEvent,
    TavernChatMessage,
    TavernChatResponse,
    TavernResponseActivity,
} from '@tavern/api';
import type { Database } from '../db/sqlite';
import { listEvents } from './chat-api';
import { createRunId } from './chat-api/ids';

export interface PersistedRuntimeEvent {
    cursor: number;
    event: AgentRuntimeEvent;
}

export function listTavernRuntimeEvents(
    options: { afterCursor?: number; limit?: number } = {},
    db?: Database
): PersistedRuntimeEvent[] {
    const afterCursor = options.afterCursor ?? 0;
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 500);
    return listEvents({ afterCursor: String(afterCursor), limit }, db).events.flatMap(
        chatEventToRuntimeEvents
    );
}

function chatEventToRuntimeEvents(event: TavernChatEvent): PersistedRuntimeEvent[] {
    switch (event.type) {
        case 'message.created': {
            const runtimeEvent = messageCreatedToRuntimeEvent(event.message, event.created_at);
            return runtimeEvent ? [{ cursor: Number(event.cursor), event: runtimeEvent }] : [];
        }
        case 'response.created':
            return [
                {
                    cursor: Number(event.cursor),
                    event: {
                        timestamp: event.created_at,
                        turn: responseToTurn(event.response),
                        type: 'turn.started',
                    },
                },
            ];
        case 'response.completed':
            return [
                {
                    cursor: Number(event.cursor),
                    event: {
                        timestamp: event.created_at,
                        turn: responseToTurn(event.response),
                        type: 'turn.completed',
                    },
                },
            ];
        case 'response.failed':
            return [
                {
                    cursor: Number(event.cursor),
                    event: {
                        error: event.response.summary ?? 'Turn failed.',
                        timestamp: event.created_at,
                        turn: responseToTurn(event.response),
                        type: 'turn.failed',
                    },
                },
            ];
        case 'response.updated':
            return event.response.summary
                ? [
                      {
                          cursor: Number(event.cursor),
                          event: {
                              isThinking: true,
                              text: event.response.summary,
                              timestamp: event.created_at,
                              turn: responseToTurn(event.response),
                              type: 'turn.replyUpdated',
                          },
                      },
                  ]
                : [];
        case 'activity.created':
        case 'activity.updated':
        case 'activity.completed':
        case 'activity.failed':
            return activityEventToRuntimeEvents(event);
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
        case 'message.delivered':
            return messageDeliveredToRuntimeEvents(event).map((runtimeEvent) => ({
                cursor: Number(event.cursor),
                event: runtimeEvent,
            }));
        case 'artifact.created':
        case 'message.deleted':
            return [];
        default:
            throw new Error('Unsupported Tavern chat event type during runtime replay.');
    }
}

function messageCreatedToRuntimeEvent(
    message: TavernChatMessage,
    timestamp: string
): AgentRuntimeEvent | null {
    if (message.role !== 'user') {
        return null;
    }

    const agentId = metadataRuntimeString(message.metadata, 'agentId');
    const sessionKey = metadataRuntimeString(message.metadata, 'sessionKey');
    if (!(agentId && sessionKey)) {
        return null;
    }

    return {
        agentId,
        chatId: message.chat_id,
        message: {
            id: message.id,
            nonce: message.nonce ?? undefined,
            parentMessageId: message.parent_message_id,
            senderId: message.author.id,
            senderName: message.author.label ?? message.author.id,
            sequence: message.sequence,
            text: messageText(message),
            threadRootId: message.thread_root_id ?? message.id,
            timestamp: message.created_at,
        },
        runId: createRunId(message.id),
        sessionKey,
        timestamp,
        type: 'chat.messageAccepted',
    };
}

function messageDeliveredToRuntimeEvents(
    event: Extract<TavernChatEvent, { type: 'message.delivered' }>
): AgentRuntimeEvent[] {
    const turn = messageToTurn(event.delivery.message);
    const text = messageText(event.delivery.message);
    const events: AgentRuntimeEvent[] = [];

    if (text.trim()) {
        events.push({
            isThinking: false,
            replace: true,
            text,
            timestamp: event.created_at,
            turn,
            type: 'turn.replyUpdated',
        });
    }

    events.push({
        timestamp: event.created_at,
        turn,
        type: 'turn.completed',
    });

    return events;
}

function activityEventToRuntimeEvents(
    event: Extract<
        TavernChatEvent,
        {
            type:
                | 'activity.completed'
                | 'activity.created'
                | 'activity.failed'
                | 'activity.updated';
        }
    >
): PersistedRuntimeEvent[] {
    const turn = activityToTurn(event.activity);
    const runtimeEvent: AgentRuntimeEvent = {
        step: {
            detail: event.activity.detail,
            id: event.activity.id,
            kind: activityKind(event.activity.kind),
            label: event.activity.title,
            status: activityStatus(event.activity.status, event.type),
            toolCallId: metadataRuntimeString(event.activity.metadata, 'toolCallId'),
            toolName: metadataRuntimeString(event.activity.metadata, 'toolName'),
        },
        timestamp: event.created_at,
        turn,
        type: 'turn.progress',
    };

    return [{ cursor: Number(event.cursor), event: runtimeEvent }];
}

function messageToTurn(
    message: TavernChatMessage
): Extract<AgentRuntimeEvent, { type: 'turn.started' }>['turn'] {
    const runId = metadataRuntimeString(message.metadata, 'runId');
    const sessionKey = metadataRuntimeString(message.metadata, 'sessionKey');

    if (!(runId && sessionKey)) {
        throw new Error(`Delivered Tavern message ${message.id} is missing runtime turn metadata.`);
    }

    return {
        agentId: metadataRuntimeString(message.metadata, 'agentId') ?? message.author.id,
        chatId: message.chat_id,
        runId,
        sessionKey,
        startedAt: metadataRuntimeString(message.metadata, 'startedAt') ?? message.created_at,
    };
}

function responseToTurn(
    response: TavernChatResponse
): Extract<AgentRuntimeEvent, { type: 'turn.started' }>['turn'] {
    return {
        agentId: metadataRuntimeString(response.metadata, 'agentId') ?? response.participant_id,
        chatId: response.chat_id,
        runId: metadataRuntimeString(response.metadata, 'runId') ?? response.id,
        sessionKey: metadataRuntimeString(response.metadata, 'sessionKey') ?? response.id,
        startedAt: metadataRuntimeString(response.metadata, 'startedAt') ?? response.created_at,
    };
}

function activityToTurn(
    activity: TavernResponseActivity
): Extract<AgentRuntimeEvent, { type: 'turn.started' }>['turn'] {
    return {
        agentId: metadataRuntimeString(activity.metadata, 'agentId') ?? 'main',
        chatId: activity.chat_id,
        runId: metadataRuntimeString(activity.metadata, 'runId') ?? activity.response_id,
        sessionKey: metadataRuntimeString(activity.metadata, 'sessionKey') ?? activity.response_id,
        startedAt: metadataRuntimeString(activity.metadata, 'startedAt') ?? activity.started_at,
    };
}

function activityKind(kind: TavernResponseActivity['kind']) {
    if (kind === 'reasoning') {
        return 'reasoning' as const;
    }
    if (kind === 'planning') {
        return 'plan' as const;
    }
    if (kind === 'command') {
        return 'command' as const;
    }
    if (kind === 'message') {
        return 'message' as const;
    }
    return 'tool' as const;
}

function activityStatus(
    status: TavernResponseActivity['status'],
    eventType: 'activity.completed' | 'activity.created' | 'activity.failed' | 'activity.updated'
) {
    if (status === 'completed') {
        return 'completed';
    }
    if (status === 'failed') {
        return 'failed';
    }
    if (eventType === 'activity.completed') {
        return 'completed';
    }
    if (eventType === 'activity.failed') {
        return 'failed';
    }
    return 'active';
}

function messageText(message: TavernChatMessage) {
    return message.content;
}

function metadataRuntimeString(metadata: Record<string, unknown>, key: string) {
    const runtime = metadata.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}
