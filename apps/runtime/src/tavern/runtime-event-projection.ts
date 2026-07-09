import type {
    AgentRuntimeEvent,
    TavernChatEvent,
    TavernChatMessage,
    TavernChatResponse,
    TavernResponseActivity,
} from '@tavern/api';
import type { Database } from '../db/sqlite';
import { log } from '../log';
import { widgetProgressFromActivity } from '../widgets/render';
import { getResponse, listEvents } from './chat-api';
import { createRunId } from './chat-api/ids';

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
        chatEventToRuntimeEvents(event, db)
    );
}

function chatEventToRuntimeEvents(event: TavernChatEvent, db?: Database): PersistedRuntimeEvent[] {
    // Composer command runs are settled evidence, not live turns; projecting
    // them would surface a phantom in-flight turn in the app.
    if (isCommandRunEvent(event)) {
        return [];
    }

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
                        error:
                            metadataRuntimeString(event.response.metadata, 'error') ??
                            metadataString(event.response.metadata, 'error') ??
                            event.response.summary ??
                            'Agent failed to produce a reply.',
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
            return activityEventToRuntimeEvents(event, db);
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
        case 'chat.cleared':
        case 'message.updated':
        case 'message.deleted':
        case 'response.deleted':
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
        case 'artifact.created':
            return [];
        default:
            throw new Error('Unsupported Tavern chat event type during runtime projection.');
    }
}

function isCommandRunEvent(event: TavernChatEvent) {
    if (
        event.type === 'response.created' ||
        event.type === 'response.updated' ||
        event.type === 'response.completed' ||
        event.type === 'response.failed'
    ) {
        return metadataRuntimeString(event.response.metadata, 'source') === 'command';
    }

    if (
        event.type === 'activity.created' ||
        event.type === 'activity.updated' ||
        event.type === 'activity.completed' ||
        event.type === 'activity.failed'
    ) {
        return event.activity.kind === 'command' && isRecord(event.activity.metadata.command);
    }

    return false;
}

function messageCreatedToRuntimeEvent(
    message: TavernChatMessage,
    timestamp: string
): AgentRuntimeEvent | null {
    if (message.role !== 'user') {
        return null;
    }

    const agentId = metadataRuntimeString(message.metadata, 'agentId');
    const agentSessionId = metadataRuntimeString(message.metadata, 'agentSessionId');
    if (!(agentId && agentSessionId)) {
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
        runId: metadataRuntimeString(message.metadata, 'runId') ?? createRunId(message.id, agentId),
        timestamp,
        type: 'chat.messageAccepted',
    };
}

function messageDeliveredToRuntimeEvents(
    event: Extract<TavernChatEvent, { type: 'message.delivered' }>
): AgentRuntimeEvent[] {
    const turn = messageToTurn(event.delivery.message);

    // A delivered message without turn metadata cannot be projected, but it
    // must not brick the whole event feed (server catch-up reads every
    // event); skip it loudly instead.
    if (!turn) {
        log.warn('Delivered Tavern message is missing runtime turn metadata', {
            messageId: event.delivery.message.id,
        });
        return [];
    }

    return [
        {
            timestamp: event.created_at,
            turn,
            type: 'turn.completed',
        },
    ];
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
    >,
    db?: Database
): PersistedRuntimeEvent[] {
    const turn = activityToTurn(event.activity, db);

    // No turn identity and no owning response: projecting would invent an
    // actor, so the activity stays execution evidence without a live step.
    if (!turn) {
        log.warn('Activity event has no resolvable turn identity', {
            activityId: event.activity.id,
            responseId: event.activity.response_id,
        });
        return [];
    }

    const detail = activityStepDetail(event.activity);
    const widget = widgetProgressFromActivity(event.activity) ?? undefined;
    const runtimeEvent: AgentRuntimeEvent = {
        step: {
            clarification: clarificationFromActivity(event.activity) ?? undefined,
            detail,
            id: event.activity.id,
            kind: activityKind(event.activity),
            label: event.activity.title,
            messagePhase: activityMessagePhase(event.activity) ?? undefined,
            status: activityStatus(event.activity.status, event.type),
            toolCallId: metadataRuntimeString(event.activity.metadata, 'toolCallId'),
            toolName: metadataRuntimeString(event.activity.metadata, 'toolName'),
            widget,
        },
        timestamp: event.created_at,
        turn,
        type: 'turn.progress',
    };

    return [{ cursor: Number(event.cursor), event: runtimeEvent }];
}

function activityStepDetail(activity: TavernResponseActivity) {
    return activity.detail;
}

function messageToTurn(
    message: TavernChatMessage
): Extract<AgentRuntimeEvent, { type: 'turn.started' }>['turn'] | null {
    const runId = metadataRuntimeString(message.metadata, 'runId');
    const sessionKey = runtimeTurnReference(message.metadata);

    if (!(runId && sessionKey)) {
        return null;
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
        sessionKey: runtimeTurnReference(response.metadata) ?? response.id,
        startedAt: metadataRuntimeString(response.metadata, 'startedAt') ?? response.created_at,
    };
}

// Activity rows may lack turn identity metadata; the owning response is the
// source of truth then. A hard-coded fallback actor would misattribute
// progress in a multi-agent chat, so a fully unresolvable activity projects
// no turn at all.
function activityToTurn(
    activity: TavernResponseActivity,
    db?: Database
): Extract<AgentRuntimeEvent, { type: 'turn.started' }>['turn'] | null {
    const metadataAgentId = metadataRuntimeString(activity.metadata, 'agentId');

    if (metadataAgentId) {
        return {
            agentId: metadataAgentId,
            chatId: activity.chat_id,
            runId: metadataRuntimeString(activity.metadata, 'runId') ?? activity.response_id,
            sessionKey: runtimeTurnReference(activity.metadata) ?? activity.response_id,
            startedAt: metadataRuntimeString(activity.metadata, 'startedAt') ?? activity.started_at,
        };
    }

    const response = getResponse(activity.response_id, db);

    if (!response) {
        return null;
    }

    const base = responseToTurn(response);

    return {
        ...base,
        runId: metadataRuntimeString(activity.metadata, 'runId') ?? base.runId,
        sessionKey: runtimeTurnReference(activity.metadata) ?? base.sessionKey,
        startedAt: metadataRuntimeString(activity.metadata, 'startedAt') ?? base.startedAt,
    };
}

function activityKind(activity: TavernResponseActivity) {
    // Notice and worker activities are recorded as kind 'custom' with their
    // discriminating source facts in metadata; the live step kind must match
    // the durable row kind so the app patches the same presentation.
    if (hasMetadataRecord(activity.metadata.runtime, 'notice')) {
        return 'notice' as const;
    }
    if (isRecord(activity.metadata.subagent)) {
        return 'worker' as const;
    }

    const kind = activity.kind;
    if (kind === 'reasoning') {
        return 'reasoning' as const;
    }
    if (kind === 'command') {
        return 'command' as const;
    }
    if (kind === 'message') {
        return 'message' as const;
    }
    if (kind === 'widget') {
        return 'widget' as const;
    }
    return 'tool' as const;
}

function activityMessagePhase(activity: TavernResponseActivity) {
    const phase = metadataRuntimeString(activity.metadata, 'messagePhase');
    if (phase === 'commentary' || phase === 'final_answer') {
        return phase;
    }
    return null;
}

function clarificationFromActivity(activity: TavernResponseActivity) {
    const clarification = isRecord(activity.metadata.clarification)
        ? activity.metadata.clarification
        : null;

    if (!clarification) {
        return null;
    }

    const requestId = readRequiredString(clarification.requestId);
    const question = readRequiredString(clarification.question);

    if (!(requestId && question)) {
        return null;
    }

    return {
        answer: readStringValue(clarification.answer),
        choices: readStringArray(clarification.choices),
        deadlineAt: readIsoString(clarification.deadlineAt),
        disposition: readClarificationDisposition(clarification.disposition),
        question,
        requestId,
    };
}

function hasMetadataRecord(value: unknown, key: string) {
    return isRecord(value) && isRecord(value[key]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function runtimeTurnReference(metadata: Record<string, unknown>) {
    return (
        metadataRuntimeString(metadata, 'agentSessionId') ??
        metadataRuntimeString(metadata, 'sessionKey')
    );
}

function metadataString(metadata: Record<string, unknown>, key: string) {
    const value = metadata[key];
    return typeof value === 'string' ? value : null;
}

function readRequiredString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringValue(value: unknown) {
    return typeof value === 'string' ? value : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}

function readIsoString(value: unknown) {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        return null;
    }

    return new Date(Date.parse(value)).toISOString();
}

function readClarificationDisposition(value: unknown): 'answered' | 'skipped' | 'timeout' | null {
    if (value === 'answered' || value === 'skipped' || value === 'timeout') {
        return value;
    }

    return null;
}
