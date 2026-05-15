import { buildTavernOutboundSessionRoute } from './channel.js';
import { DEFAULT_ACCOUNT_ID, TAVERN_CHANNEL_ID } from './config.js';
import {
    persistAcceptedInboundMessage,
    persistDeliveredTurnMessage,
    persistFailedTurnMessages,
    readFinalAssistantReply,
} from './failed-inbound-message.js';
import { registerTavernDeliveryContext, sendTavernTextMessage } from './outbound.js';
import { createTurnProgressBroadcaster } from './turn-progress.js';

export async function handleTavernInboundMessage({ context, event, runtime, sendAccepted }) {
    const input = parseTavernRelayInbound(event);
    const cfg = runtime.config.current();
    const expectedSessionKey = buildTavernOutboundSessionRoute({
        accountId: event.accountId ?? DEFAULT_ACCOUNT_ID,
        agentId: input.agentId,
        cfg,
        target: `chat:${input.chatId}`,
    }).sessionKey;

    if (input.sessionKey !== expectedSessionKey) {
        throw new Error(`Tavern chat ${input.chatId} received an unexpected session key.`);
    }

    const acceptedAt = new Date().toISOString();
    const runId = input.turnId ?? `tavern-run:${input.messageId}`;
    const turn = {
        agentId: input.agentId,
        chatId: input.chatId,
        messageId: input.messageId,
        runId,
        sessionKey: input.sessionKey,
        startedAt: acceptedAt,
    };
    const storePath = runtime.channel.session.resolveStorePath(cfg.session?.store, {
        agentId: input.agentId,
    });

    await persistAcceptedInboundMessage({ createSession: true, input, storePath }).catch(
        () => undefined
    );
    context.broadcast('plugin.tavern.turn.started', turn, { dropIfSlow: true });
    sendAccepted({
        acceptedAt,
        runId,
        sessionKey: input.sessionKey,
        status: 'accepted',
    });

    runTavernTurn({ context, input, runId, runtime, startedAt: acceptedAt }).catch((error) => {
        context.broadcast(
            'plugin.tavern.turn.failed',
            {
                ...turn,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            },
            { dropIfSlow: true }
        );
    });
}

async function runTavernTurn({ context, input, runId, runtime, startedAt }) {
    const timing = createTurnTimingBroadcaster(context, {
        agentId: input.agentId,
        chatId: input.chatId,
        messageId: input.messageId,
        runId,
        sessionKey: input.sessionKey,
        startedAt,
    });
    const cfg = runtime.config.current();
    const timestampMs = Date.parse(input.sentAt);
    const timestamp = Number.isFinite(timestampMs) ? timestampMs : Date.now();
    const storePath = runtime.channel.session.resolveStorePath(cfg.session?.store, {
        agentId: input.agentId,
    });
    const target = `chat:${input.chatId}`;
    const turnEvent = {
        agentId: input.agentId,
        chatId: input.chatId,
        messageId: input.messageId,
        runId,
        sessionKey: input.sessionKey,
        startedAt,
    };
    const broadcastProgress = createTurnProgressBroadcaster(context, turnEvent);
    const persistAcceptedInbound = createAcceptedInboundPersistor({ input, storePath });
    const sessionMetaTasks = [];
    let observedFinalReplyDelivery = false;
    const ctxPayload = runtime.channel.turn.buildContext({
        channel: TAVERN_CHANNEL_ID,
        accountId: DEFAULT_ACCOUNT_ID,
        messageId: input.messageId,
        messageIdFull: input.messageId,
        timestamp,
        from: target,
        sender: {
            id: input.sender.id,
            name: input.sender.name,
        },
        conversation: {
            kind: 'channel',
            id: input.chatId,
            label: input.chatId,
            nativeChannelId: input.chatId,
            routePeer: {
                kind: 'channel',
                id: input.chatId,
            },
        },
        route: {
            agentId: input.agentId,
            accountId: DEFAULT_ACCOUNT_ID,
            routeSessionKey: input.sessionKey,
        },
        reply: {
            to: target,
            originatingTo: target,
            nativeChannelId: input.chatId,
        },
        access: {
            commands: {
                useAccessGroups: false,
                allowTextCommands: true,
                authorizers: [{ configured: true, allowed: true }],
            },
        },
        extra: input.metadata
            ? {
                  TavernMessageMetadata: input.metadata,
              }
            : undefined,
        message: {
            rawBody: input.text,
            bodyForAgent: input.text,
            commandBody: input.text,
            envelopeFrom: input.sender.name,
            inboundHistory: input.recentMessages,
        },
    });

    const unregisterDeliveryContext = registerTavernDeliveryContext({
        accountId: DEFAULT_ACCOUNT_ID,
        agentId: input.agentId,
        chatId: input.chatId,
        context,
        markFinalReplySent: () => {
            observedFinalReplyDelivery = true;
        },
        runId,
        sessionKey: input.sessionKey,
    });

    let turnResult;
    try {
        timing('runAssembled.start');
        turnResult = await runtime.channel.turn.runAssembled({
            agentId: input.agentId,
            channel: TAVERN_CHANNEL_ID,
            accountId: DEFAULT_ACCOUNT_ID,
            routeSessionKey: input.sessionKey,
            storePath,
            ctxPayload,
            cfg,
            dispatchReplyWithBufferedBlockDispatcher:
                runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher,
            delivery: createTavernDeliveryAdapter({
                cfg,
                input,
                markFinalReplySent: () => {
                    observedFinalReplyDelivery = true;
                },
                storePath,
            }),
            recordInboundSession: runtime.channel.session.recordInboundSession,
            record: {
                onRecordError: throwAsError,
                trackSessionMetaTask: (task) => {
                    timing('sessionMetaTask.tracked');
                    sessionMetaTasks.push(
                        Promise.resolve(task).then(() => persistAcceptedInbound())
                    );
                },
            },
            log: (event) => {
                timing(`kernel.${event.stage}.${event.event}`);
            },
            messageId: input.messageId,
            replyPipeline: {},
            replyOptions: {
                bootstrapContextMode: 'lightweight',
                onCommandOutput: (payload) =>
                    broadcastProgress({
                        detail: payload.output ?? payload.summary ?? payload.status,
                        id: payload.itemId ?? payload.toolCallId ?? payload.name,
                        kind: 'command',
                        label: payload.title ?? payload.name ?? 'Command',
                        status:
                            payload.status === 'completed'
                                ? 'completed'
                                : payload.status === 'failed'
                                  ? 'failed'
                                  : 'active',
                    }),
                onItemEvent: (payload) =>
                    broadcastProgress({
                        detail: payload.summary ?? payload.progressText ?? payload.meta,
                        id: payload.itemId ?? payload.title ?? payload.name,
                        kind: payload.kind === 'tool' ? 'tool' : 'message',
                        label: payload.title ?? payload.name ?? payload.kind ?? 'Working',
                        status:
                            payload.status === 'completed' || payload.phase === 'completed'
                                ? 'completed'
                                : payload.status === 'failed' || payload.phase === 'failed'
                                  ? 'failed'
                                  : 'active',
                    }),
                onPlanUpdate: (payload) =>
                    broadcastProgress({
                        detail: payload.explanation,
                        id: payload.source ?? payload.title ?? 'plan',
                        kind: 'plan',
                        label: payload.title ?? 'Updated plan',
                        status: payload.phase === 'completed' ? 'completed' : 'active',
                    }),
                onReasoningStream: () => {
                    broadcastProgress({
                        id: 'reasoning',
                        kind: 'reasoning',
                        label: 'Reasoning',
                        status: 'active',
                    });
                },
                onToolResult: (payload) =>
                    broadcastProgress({
                        detail: payload.text,
                        id: payload.toolCallId ?? payload.name,
                        kind: 'tool',
                        label: payload.name ?? 'Tool result',
                        status: 'completed',
                    }),
                runId,
                onToolStart: (payload) =>
                    broadcastProgress({
                        detail: payload.phase,
                        id: payload.toolCallId ?? payload.name,
                        kind: 'tool',
                        label: payload.name ? `Using ${payload.name}` : 'Using tool',
                        status: 'active',
                    }),
                suppressDefaultToolProgressMessages: true,
            },
        });
        timing('runAssembled.done');
    } catch (error) {
        timing('runAssembled.error', {
            error: error instanceof Error ? error.message : String(error),
        });
        await settleSessionMetaTasks(sessionMetaTasks);
        await persistFailedTurnMessages({ error, input, runId, storePath }).catch(() => undefined);
        throw error;
    } finally {
        unregisterDeliveryContext();
    }

    const dispatchResult = turnResult?.dispatchResult ?? turnResult;

    if (!hasFinalReplyDispatch(dispatchResult, { observedFinalReplyDelivery })) {
        await settleSessionMetaTasks(sessionMetaTasks);
        const finalReplyText = await readFinalAssistantReply({ input, storePath });

        if (finalReplyText) {
            context.broadcast(
                'plugin.tavern.message.created',
                {
                    agentId: input.agentId,
                    chatId: input.chatId,
                    runId,
                    sessionKey: input.sessionKey,
                    text: finalReplyText,
                    timestamp: new Date().toISOString(),
                },
                { dropIfSlow: true }
            );
            context.broadcast(
                'plugin.tavern.turn.completed',
                {
                    agentId: input.agentId,
                    chatId: input.chatId,
                    messageId: input.messageId,
                    runId,
                    sessionKey: input.sessionKey,
                    startedAt,
                    timestamp: new Date().toISOString(),
                },
                { dropIfSlow: true }
            );
            return;
        }

        const error = new Error('OpenClaw turn ended before producing a reply.');

        await persistFailedTurnMessages({ error, input, runId, storePath }).catch(() => undefined);
        throw error;
    }

    await settleSessionMetaTasks(sessionMetaTasks);
    context.broadcast(
        'plugin.tavern.turn.completed',
        {
            agentId: input.agentId,
            chatId: input.chatId,
            messageId: input.messageId,
            runId,
            sessionKey: input.sessionKey,
            startedAt,
            timestamp: new Date().toISOString(),
        },
        { dropIfSlow: true }
    );
}

function parseTavernRelayInbound(event) {
    const message = event.message ?? {};
    const conversation = event.conversation ?? {};

    return {
        agentId: requireString(event.agentId, 'agentId'),
        chatId: requireString(conversation.id, 'conversation.id'),
        messageId: requireString(message.id, 'message.id'),
        metadata: readRecord(message.metadata),
        sentAt: readString(message.timestamp) ?? new Date().toISOString(),
        sessionKey: requireString(event.sessionKey, 'sessionKey'),
        text: requireString(message.text, 'message.text'),
        turnId: readString(event.turnId),
        sender: {
            id: readString(message.senderId) ?? 'tavern-user',
            name: readString(message.senderName) ?? 'Tavern',
        },
        recentMessages: undefined,
    };
}

function createTurnTimingBroadcaster(context, turn) {
    const startMs = performance.now();

    return (stage, extra = {}) => {
        context.broadcast(
            'plugin.tavern.turn.timing',
            {
                ...turn,
                elapsedMs: Math.round(performance.now() - startMs),
                stage,
                timestamp: new Date().toISOString(),
                ...extra,
            },
            { dropIfSlow: true }
        );
    };
}

function createTavernDeliveryAdapter({ cfg, input, markFinalReplySent, storePath }) {
    return {
        durable: (_payload, info = {}) =>
            info.kind === 'final'
                ? {
                      to: `chat:${input.chatId}`,
                  }
                : false,
        deliver: async (payload, info = {}) => {
            if (info.kind !== 'final') {
                return { visibleReplySent: false };
            }

            const text = typeof payload?.text === 'string' ? payload.text : '';
            const result = await sendTavernTextMessage({
                accountId: DEFAULT_ACCOUNT_ID,
                cfg,
                text,
                to: `chat:${input.chatId}`,
            });

            if (text.trim()) {
                markFinalReplySent?.();
            }

            return {
                messageIds: [result.messageId],
                receipt: result.receipt,
                visibleReplySent: Boolean(text.trim()),
            };
        },
        onDelivered: async (payload, info = {}) => {
            const text = typeof payload?.text === 'string' ? payload.text : '';

            if (info.kind === 'final' && looksLikeDeliveredFailureNotice(text)) {
                await persistDeliveredTurnMessage({ input, storePath, text });
            }
        },
        onError: throwAsError,
    };
}

function createAcceptedInboundPersistor({ input, storePath }) {
    let pending = Promise.resolve();

    return () => {
        pending = pending
            .then(() => persistAcceptedInboundMessage({ input, storePath }))
            .catch(() => undefined);
        return pending;
    };
}

function hasFinalReplyDispatch(dispatchResult, signals = {}) {
    if (signals.observedFinalReplyDelivery === true) {
        return true;
    }

    if (!dispatchResult || typeof dispatchResult !== 'object') {
        return false;
    }

    if (dispatchResult.queuedFinal === true) {
        return true;
    }

    return Number(dispatchResult.counts?.final ?? 0) > 0;
}

async function settleSessionMetaTasks(tasks) {
    if (tasks.length === 0) {
        return;
    }

    await Promise.allSettled(tasks);
}

function throwAsError(error) {
    throw error instanceof Error ? error : new Error(String(error));
}

function looksLikeDeliveredFailureNotice(text) {
    const normalized = String(text).trim();

    if (!normalized.startsWith('⚠️')) {
        return false;
    }

    return (
        normalized.includes('Please try again') ||
        normalized.includes('use /new') ||
        normalized.includes('Model login failed on the gateway') ||
        normalized.includes('Missing API key') ||
        normalized.includes('Context overflow') ||
        normalized.includes('Session history was corrupted') ||
        normalized.includes('Message ordering conflict')
    );
}

function readRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}

function requireString(value, label) {
    const text = readString(value);
    if (text) {
        return text;
    }
    throw new Error(`${label} is required.`);
}

function readString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
