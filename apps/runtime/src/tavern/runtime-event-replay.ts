import type {
    AgentRuntimeEvent,
    TavernChatActivity,
    TavernChatEvent,
    TavernChatMessage,
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
        case 'chat.activity.updated':
        case 'chat.activity.completed':
        case 'chat.activity.failed':
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
        case 'message.deleted':
            return [];
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
            type: 'chat.activity.completed' | 'chat.activity.failed' | 'chat.activity.updated';
        }
    >
): PersistedRuntimeEvent[] {
    const turn = activityToTurn(event.activity);
    const events: AgentRuntimeEvent[] = [];

    if (event.type === 'chat.activity.completed') {
        events.push({
            timestamp: event.created_at,
            turn,
            type: 'turn.completed',
        });
    } else if (event.type === 'chat.activity.failed') {
        events.push({
            error: event.activity.summary ?? 'Turn failed.',
            timestamp: event.created_at,
            turn,
            type: 'turn.failed',
        });
    } else if (event.activity.summary) {
        events.push({
            isThinking: true,
            text: event.activity.summary,
            timestamp: event.created_at,
            turn,
            type: 'turn.replyUpdated',
        });
    } else if (event.activity.steps.length === 0) {
        events.push({
            timestamp: event.created_at,
            turn,
            type: 'turn.started',
        });
    }

    for (const step of event.activity.steps) {
        events.push({
            step: {
                detail: typeof step.metadata.detail === 'string' ? step.metadata.detail : null,
                id: step.id,
                kind: activityStepKind(step.kind),
                label: step.label,
                status:
                    step.status === 'completed'
                        ? 'completed'
                        : step.status === 'failed'
                          ? 'failed'
                          : 'active',
            },
            timestamp: event.created_at,
            turn,
            type: 'turn.progress',
        });
    }

    return events.map((runtimeEvent) => ({
        cursor: Number(event.cursor),
        event: runtimeEvent,
    }));
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

function activityToTurn(
    activity: TavernChatActivity
): Extract<AgentRuntimeEvent, { type: 'turn.started' }>['turn'] {
    return {
        agentId: activityMetadataString(activity, 'agentId') ?? activity.agent_id,
        chatId: activity.chat_id,
        runId: activity.run_id,
        sessionKey: activityMetadataString(activity, 'sessionKey') ?? activity.run_id,
        startedAt: activityMetadataString(activity, 'startedAt') ?? activity.updated_at,
    };
}

function activityStepKind(kind: TavernChatActivity['steps'][number]['kind']) {
    if (kind === 'thinking') {
        return 'reasoning' as const;
    }
    if (kind === 'custom') {
        return 'plan' as const;
    }
    if (kind === 'file') {
        return 'tool' as const;
    }
    return kind;
}

function messageText(message: TavernChatMessage) {
    return message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.content)
        .join('\n');
}

function activityMetadataString(activity: TavernChatActivity, key: string) {
    return metadataRuntimeString(activity.metadata, key);
}

function metadataRuntimeString(metadata: Record<string, unknown>, key: string) {
    const runtime = metadata.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}
