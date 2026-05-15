import { type AgentRuntimeEvent, agentRuntimeEventSchema } from '@tavern/agent-runtime-protocol';
import { createOpenClawGatewayClient } from '../gateway/client.ts';
import { asRecord, nowIso, readString, toIsoString } from '../gateway/records.ts';
import type {
    OpenClawGatewayClient,
    OpenClawGatewayEvent,
    OpenClawGatewayOptions,
} from '../gateway/types.ts';
import { resolveOpenClawConversationIdentity } from '../mappers/chats/conversation-identity.ts';
import { parseOpenClawSessionKey } from '../mappers/sessions/session-key.ts';

export interface OpenClawEventSubscription {
    close(): void;
}

export interface OpenClawEventSubscriptionObserver {
    onClose?: () => void;
}

export interface OpenClawAgentRuntimeEventOptions extends OpenClawGatewayOptions {
    gateway?: OpenClawGatewayClient;
}

export const openClawGatewaySubscriptionMethods = ['sessions.subscribe'] as const;

export async function subscribeOpenClawAgentRuntimeEvents(
    options: OpenClawAgentRuntimeEventOptions,
    handler: (event: AgentRuntimeEvent) => void,
    observer: OpenClawEventSubscriptionObserver = {}
): Promise<OpenClawEventSubscription> {
    const gateway = options.gateway ?? createOpenClawGatewayClient(options);
    await gateway.connect();

    for (const method of openClawGatewaySubscriptionMethods) {
        await gateway.request(method, {});
    }

    const off = gateway.onEvent((event) => {
        try {
            for (const mapped of mapOpenClawGatewayEvent(event)) {
                handler(mapped);
            }
        } catch (error) {
            console.warn('[tavern] failed to map OpenClaw Gateway event', error);
        }
    });
    const offClose = gateway.onClose(() => {
        observer.onClose?.();
    });

    return {
        close() {
            off();
            offClose();
            gateway.close();
        },
    };
}

export function mapOpenClawGatewayEvent(event: OpenClawGatewayEvent): AgentRuntimeEvent[] {
    const payload = asRecord(event.payload);
    const timestamp = nowIso();

    switch (event.event) {
        case 'plugin.tavern.turn.started': {
            return mapOpenClawTavernTurnEvent(payload, timestamp, 'turn.started');
        }
        case 'plugin.tavern.turn.progress': {
            return mapOpenClawTavernTurnProgressEvent(payload, timestamp);
        }
        case 'plugin.tavern.message.created': {
            return mapOpenClawTavernDeliveredMessageEvent(payload, timestamp);
        }
        case 'plugin.tavern.turn.completed': {
            return mapOpenClawTavernTurnEvent(payload, timestamp, 'turn.completed');
        }
        case 'plugin.tavern.turn.failed': {
            return mapOpenClawTavernTurnEvent(payload, timestamp, 'turn.failed');
        }
        case 'chat': {
            return mapOpenClawChatEvent(payload, timestamp);
        }
        case 'session.tool': {
            return mapOpenClawSessionInvalidatedEvent(payload, timestamp);
        }
        case 'sessions.changed': {
            return mapOpenClawSessionInvalidatedEvent(payload, timestamp);
        }
        case 'session.message': {
            return [
                ...mapOpenClawSessionMessageEvent(payload, timestamp),
                ...mapOpenClawSessionInvalidatedEvent(payload, timestamp),
            ];
        }
        case 'cron': {
            const cronJobId = readString(payload, ['jobId', 'id']);

            if (!cronJobId) {
                return [];
            }

            const runId = readString(payload, ['runId']);
            const status = readString(payload, ['status', 'state']);

            if (runId && (status === 'finished' || status === 'success' || status === 'error')) {
                return [
                    agentRuntimeEventSchema.parse({
                        cronJobId,
                        runId,
                        timestamp,
                        type: 'cron.runFinished',
                    }),
                ];
            }

            if (runId && status === 'running') {
                return [
                    agentRuntimeEventSchema.parse({
                        cronJobId,
                        runId,
                        timestamp,
                        type: 'cron.runStarted',
                    }),
                ];
            }

            return [
                agentRuntimeEventSchema.parse({
                    cronJobId,
                    timestamp,
                    type: 'cron.updated',
                }),
            ];
        }
        default:
            return [];
    }
}

function mapOpenClawSessionMessageEvent(
    payload: Record<string, unknown>,
    timestamp: string
): AgentRuntimeEvent[] {
    const message = asRecord(payload.message);
    const role = readString(message, ['role']);

    if (role !== 'assistant') {
        return [];
    }

    const visibleReplyText = readOpenClawChatReplyText(message);
    const sessionKey = readString(payload, ['sessionKey', 'key']);
    const messageId = readString(payload, ['messageId']);

    if (!(visibleReplyText && sessionKey && messageId)) {
        return [];
    }

    const keyParts = parseOpenClawSessionKey(sessionKey);
    if (keyParts.platform === 'tavern') {
        return [];
    }

    const agentId = readString(payload, ['agentId', 'agent']) ?? keyParts.agentId;
    const chatId = resolveChatEventChatId(payload, sessionKey);
    const runId = readString(payload, ['runId', 'taskId']) ?? messageId;

    if (!(agentId && chatId)) {
        return [];
    }

    return [
        agentRuntimeEventSchema.parse({
            isThinking: false,
            replace: true,
            text: visibleReplyText,
            timestamp,
            turn: {
                agentId,
                chatId,
                runId,
                sessionKey,
                startedAt:
                    toIsoString(payload.startedAt ?? asRecord(payload.session).startedAt) ??
                    toIsoString(message.timestamp) ??
                    timestamp,
            },
            type: 'turn.replyUpdated',
        }),
    ];
}

function mapOpenClawTavernTurnProgressEvent(
    payload: Record<string, unknown>,
    timestamp: string
): AgentRuntimeEvent[] {
    const turn = mapOpenClawTavernTurn(payload, timestamp);

    if (!turn) {
        return [];
    }

    const stepRecord = asRecord(payload.step);
    const id = readString(stepRecord, ['id']) ?? readString(payload, ['stepId', 'id']);
    const kind = readString(stepRecord, ['kind']) ?? readString(payload, ['kind']);
    const label = readString(stepRecord, ['label']) ?? readString(payload, ['label']);
    const status = readString(stepRecord, ['status']) ?? readString(payload, ['status']);

    if (!(id && kind && label)) {
        return [];
    }

    return [
        agentRuntimeEventSchema.parse({
            step: {
                detail: readString(stepRecord, ['detail', 'description', 'summary']),
                id,
                kind,
                label,
                status: status ?? 'active',
            },
            timestamp,
            turn,
            type: 'turn.progress',
        }),
    ];
}

function mapOpenClawSessionInvalidatedEvent(
    payload: Record<string, unknown>,
    timestamp: string
): AgentRuntimeEvent[] {
    const record = asRecord(payload.session ?? payload);
    const sessionKey = readString(record, ['sessionKey', 'key']);

    if (!sessionKey) {
        return [];
    }

    return [
        agentRuntimeEventSchema.parse({
            sessionKey,
            timestamp,
            type: 'session.invalidated',
        }),
    ];
}

function mapOpenClawTavernDeliveredMessageEvent(
    payload: Record<string, unknown>,
    timestamp: string
): AgentRuntimeEvent[] {
    const turn = mapOpenClawTavernTurn(payload, timestamp);
    const text = readString(payload, ['text']);

    if (!(turn && text)) {
        return [];
    }

    return [
        agentRuntimeEventSchema.parse({
            isThinking: false,
            replace: true,
            text,
            timestamp,
            turn,
            type: 'turn.replyUpdated',
        }),
    ];
}

function mapOpenClawTavernTurnEvent(
    payload: Record<string, unknown>,
    timestamp: string,
    type: 'turn.completed' | 'turn.failed' | 'turn.started'
): AgentRuntimeEvent[] {
    const turn = mapOpenClawTavernTurn(payload, timestamp);

    if (!turn) {
        return [];
    }

    if (type === 'turn.failed') {
        return [
            agentRuntimeEventSchema.parse({
                error:
                    readString(payload, ['error', 'errorMessage']) ??
                    readString(asRecord(payload.error), ['message']) ??
                    'OpenClaw Tavern turn failed.',
                timestamp,
                turn,
                type,
            }),
        ];
    }

    return [
        agentRuntimeEventSchema.parse({
            timestamp,
            turn,
            type,
        }),
    ];
}

function mapOpenClawTavernTurn(payload: Record<string, unknown>, timestamp: string) {
    const agentId = readString(payload, ['agentId', 'agent']);
    const chatId = readString(payload, ['chatId', 'tavernChatId']);
    const runId = readString(payload, ['runId', 'taskId', 'id']);
    const sessionKey = readString(payload, ['sessionKey', 'key']);

    if (!(agentId && chatId && runId && sessionKey)) {
        return null;
    }

    return {
        agentId,
        chatId,
        runId,
        sessionKey,
        startedAt: toIsoString(payload.startedAt ?? payload.timestamp) ?? timestamp,
    };
}

function mapOpenClawChatEvent(
    payload: Record<string, unknown>,
    timestamp: string
): AgentRuntimeEvent[] {
    const state = readString(payload, ['state', 'status']);
    const sessionKey = readString(payload, ['sessionKey', 'key']);
    const runId = readString(payload, ['runId', 'taskId', 'id']);

    if (!(state && sessionKey && runId)) {
        return [];
    }

    const keyParts = parseOpenClawSessionKey(sessionKey);
    const agentId = readString(payload, ['agentId', 'agent']) ?? keyParts.agentId;
    const chatId = resolveChatEventChatId(payload, sessionKey);

    if (!(agentId && chatId)) {
        return [];
    }

    const message = asRecord(payload.message);
    const turn = {
        agentId,
        chatId,
        runId,
        sessionKey,
        startedAt:
            toIsoString(payload.startedAt ?? payload.timestamp ?? message.timestamp) ?? timestamp,
    };

    const visibleReplyText = readOpenClawChatReplyText(message);

    if (state === 'started' || state === 'running') {
        return [
            agentRuntimeEventSchema.parse({
                timestamp,
                turn,
                type: 'turn.started',
            }),
        ];
    }

    if (state === 'delta') {
        if (!visibleReplyText) {
            return [];
        }

        return [
            agentRuntimeEventSchema.parse({
                replace: false,
                text: visibleReplyText,
                timestamp,
                turn,
                type: 'turn.replyUpdated',
            }),
        ];
    }

    if (state === 'final' || state === 'completed' || state === 'done') {
        const events: AgentRuntimeEvent[] = [];

        if (visibleReplyText) {
            events.push(
                agentRuntimeEventSchema.parse({
                    isThinking: false,
                    replace: true,
                    text: visibleReplyText,
                    timestamp,
                    turn,
                    type: 'turn.replyUpdated',
                })
            );
        }

        events.push(
            agentRuntimeEventSchema.parse({
                timestamp,
                turn,
                type: 'turn.completed',
            })
        );

        return events;
    }

    if (state === 'error' || state === 'failed') {
        return [
            agentRuntimeEventSchema.parse({
                error:
                    readString(payload, ['error']) ??
                    readString(asRecord(message.error), ['message']) ??
                    'OpenClaw Tavern turn failed.',
                timestamp,
                turn,
                type: 'turn.failed',
            }),
        ];
    }

    return [];
}

function readOpenClawChatReplyText(message: Record<string, unknown>) {
    const directText = readString(message, ['text']);

    if (directText) {
        return directText;
    }

    const content = Array.isArray(message.content) ? message.content : null;

    if (!content) {
        return null;
    }

    const text = content
        .map((part) => asRecord(part))
        .filter((part) => readString(part, ['type']) === 'text')
        .map((part) => readString(part, ['text']))
        .filter((part): part is string => Boolean(part))
        .join('');

    return text || null;
}

function resolveChatEventChatId(payload: Record<string, unknown>, sessionKey: string) {
    const fromPayload = readString(payload, ['chatId', 'tavernChatId']);
    const metadata = asRecord(payload.metadata);
    const tavern = asRecord(metadata.tavern);
    const fromMetadata = readString(tavern, ['chatId']);

    if (fromPayload) {
        return fromPayload;
    }

    if (fromMetadata) {
        return fromMetadata;
    }

    const identity = resolveOpenClawConversationIdentity({
        record: payload,
        sessionKey,
    });
    if (identity?.platform === 'tavern') {
        return identity.id;
    }

    return parseOpenClawSessionKey(sessionKey).target?.replace(/^chat:/u, '') ?? null;
}
