import { readFile } from 'node:fs/promises';
import { buildTavernOutboundSessionRoute } from './channel.js';
import { DEFAULT_ACCOUNT_ID, TAVERN_CHANNEL_ID } from './config.js';
import {
    persistAcceptedInboundMessage,
    persistDeliveredTurnMessage,
    persistFailedTurnMessages,
    readTranscriptSession,
} from './failed-inbound-message.js';
import { buildAcceptedTavernMetadata, registerActiveTavernTurn } from './message-identity.js';
import { registerTavernDeliveryContext, sendTavernTextMessage } from './outbound.js';
import { createTurnProgressProjector } from './turn-progress.js';

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
    const runId = input.turnId ?? buildRunId(input.messageId);
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
    await requireTavernApi(context).updateTurnActivity(turn, { status: 'running' });
    sendAccepted({
        acceptedAt,
        cursor: input.cursor,
        messageId: input.messageId,
        nonce: input.nonce,
        runId,
        sequence: input.sequence,
        sessionKey: input.sessionKey,
        status: 'accepted',
    });

    runTavernTurn({ context, input, runId, runtime, startedAt: acceptedAt }).catch((error) => {
        void requireTavernApi(context).updateTurnActivity(turn, {
            status: 'failed',
            summary: error instanceof Error ? error.message : String(error),
        });
    });
}

function buildRunId(messageId) {
    return `run_${stripPrefix(String(messageId), 'msg_')}`;
}

function stripPrefix(value, prefix) {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

async function runTavernTurn({ context, input, runId, runtime, startedAt }) {
    const timing = createTurnTimingLogger();
    const cfg = runtime.config.current();
    const timestampMs = Date.parse(input.sentAt);
    const timestamp = Number.isFinite(timestampMs) ? timestampMs : Date.now();
    const storePath = runtime.channel.session.resolveStorePath(cfg.session?.store, {
        agentId: input.agentId,
    });
    const target = `chat:${input.chatId}`;
    const persistAcceptedInbound = createAcceptedInboundPersistor({ input, storePath });
    const sessionMetaTasks = [];
    let observedFinalReplyDelivery = false;
    const acceptedMetadata = buildAcceptedTavernMetadata(input);
    const partialReplies = createPartialReplyTracker();
    const unregisterActiveTurn = registerActiveTavernTurn(input);
    const turnProgress = createTurnProgressProjector({
        context,
        input,
        runId,
        startedAt,
    });
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
            kind: input.conversationKind,
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
        extra: {
            TavernMessageMetadata: acceptedMetadata,
        },
        message: {
            rawBody: input.text,
            bodyForAgent: input.text,
            commandBody: input.text,
            envelopeFrom: input.sender.name,
            inboundHistory: input.recentMessages,
            parentMessageId: input.parentMessageId,
            sequence: input.sequence,
            threadRootId: input.threadRootId,
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
                context,
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
                allowProgressCallbacksWhenSourceDeliverySuppressed: true,
                bootstrapContextMode: 'lightweight',
                onApprovalEvent: (event) => {
                    partialReplies.stopAcceptingPreamble();
                    turnProgress.handle({
                        data: event,
                        stream: 'approval',
                    });
                },
                onCommandOutput: (event) => {
                    partialReplies.stopAcceptingPreamble();
                    turnProgress.handle({
                        data: event,
                        stream: 'command_output',
                    });
                },
                onCompactionEnd: () =>
                    turnProgress.handle({
                        data: {
                            completed: true,
                            phase: 'end',
                        },
                        stream: 'compaction',
                    }),
                onCompactionStart: () =>
                    turnProgress.handle({
                        data: {
                            phase: 'start',
                        },
                        stream: 'compaction',
                    }),
                onAgentEvent: (event) => turnProgress.handle(event),
                onItemEvent: (event) => {
                    if (isWorkItemEvent(event)) {
                        partialReplies.stopAcceptingPreamble();
                    }
                    turnProgress.handle({
                        data: event,
                        stream: 'item',
                    });
                },
                onPatchSummary: (event) => {
                    partialReplies.stopAcceptingPreamble();
                    turnProgress.handle({
                        data: event,
                        stream: 'patch',
                    });
                },
                onPartialReply: (event) =>
                    emitPartialReplyUpdate({
                        context,
                        event,
                        input,
                        partialReplies,
                        runId,
                        startedAt,
                    }),
                onReasoningStream: (event) =>
                    turnProgress.handle({
                        data: {
                            text: typeof event?.text === 'string' ? event.text : '',
                        },
                        stream: 'thinking',
                    }),
                onPlanUpdate: (event) =>
                    turnProgress.handle({
                        data: event,
                        stream: 'plan',
                    }),
                onToolStart: (event) => {
                    partialReplies.stopAcceptingPreamble();
                    turnProgress.handle({
                        data: event,
                        stream: 'tool',
                    });
                },
                runId,
                suppressDefaultToolProgressMessages: true,
                suppressPromptPersistence: true,
            },
        });
        timing('runAssembled.done');
        await settleSessionMetaTasks(sessionMetaTasks);
        const dispatchResult = turnResult?.dispatchResult ?? turnResult;

        if (!hasFinalReplyDispatch(dispatchResult, { observedFinalReplyDelivery })) {
            await settleSessionMetaTasks(sessionMetaTasks);
            const error = new Error('OpenClaw turn ended before producing a reply.');

            await requireTavernApi(context).updateTurnActivity(
                {
                    agentId: input.agentId,
                    chatId: input.chatId,
                    messageId: input.messageId,
                    runId,
                    sessionKey: input.sessionKey,
                    startedAt,
                },
                {
                    status: 'failed',
                    summary: error.message,
                }
            );
            void persistFailedTurnMessages({ error, input, runId, storePath }).catch(
                () => undefined
            );
            return;
        }

        await settleSessionMetaTasks(sessionMetaTasks);
        await updateTurnReasoningFromTranscript({ context, input, runId, startedAt, storePath });
        await updateTurnCompleted({ context, input, runId, startedAt });
    } catch (error) {
        timing('runAssembled.error', {
            error: error instanceof Error ? error.message : String(error),
        });
        await settleSessionMetaTasks(sessionMetaTasks);
        await persistFailedTurnMessages({ error, input, runId, storePath }).catch(() => undefined);
        throw error;
    } finally {
        unregisterActiveTurn();
        unregisterDeliveryContext();
    }
}

function emitPartialReplyUpdate({ context, event, input, partialReplies, runId, startedAt }) {
    const text = typeof event?.text === 'string' ? event.text : '';
    const delta = typeof event?.delta === 'string' ? event.delta : undefined;
    const visibleText = text.trim() || (delta ?? '').trim();

    if (visibleText.length === 0) {
        return;
    }

    const step = partialReplies.update(visibleText);

    if (!step) {
        return;
    }

    void requireTavernApi(context).updateTurnActivity(
        {
            agentId: input.agentId,
            chatId: input.chatId,
            messageId: input.messageId,
            runId,
            sessionKey: input.sessionKey,
            startedAt,
        },
        {
            status: 'running',
            summary: text,
            step: {
                completed_at: null,
                id: step.id,
                kind: 'message',
                label: 'Assistant reply',
                metadata: {
                    detail: step.text,
                },
                started_at: step.startedAt,
                status: 'running',
            },
        }
    );
}

function createPartialReplyTracker() {
    let sequence = 0;
    let current = null;
    let acceptsPreamble = true;

    return {
        stopAcceptingPreamble() {
            acceptsPreamble = false;
        },
        update(text) {
            if (!acceptsPreamble) {
                return null;
            }

            if (!(current && (text.startsWith(current.text) || current.text.startsWith(text)))) {
                sequence += 1;
                current = {
                    id: `assistant-reply:${sequence}`,
                    startedAt: new Date().toISOString(),
                    text,
                };
                return current;
            }

            current = {
                ...current,
                text,
            };

            return current;
        },
    };
}

function isWorkItemEvent(event) {
    const kind = readString(event?.kind) ?? readString(event?.type);

    return kind !== 'reasoning' && kind !== 'message' && kind !== 'assistant_message';
}

function updateTurnCompleted({ context, input, runId, startedAt }) {
    return requireTavernApi(context).updateTurnActivity(
        {
            agentId: input.agentId,
            chatId: input.chatId,
            messageId: input.messageId,
            runId,
            sessionKey: input.sessionKey,
            startedAt,
        },
        {
            status: 'completed',
        }
    );
}

async function updateTurnReasoningFromTranscript({ context, input, runId, startedAt, storePath }) {
    const session = await readTranscriptSession({ input, storePath });

    if (!session) {
        return;
    }

    const reasoning = await readLatestAssistantReasoning({
        after: input.sentAt,
        transcriptPath: session.transcriptPath,
    });

    if (!reasoning) {
        return;
    }

    await requireTavernApi(context).updateTurnActivity(
        {
            agentId: input.agentId,
            chatId: input.chatId,
            messageId: input.messageId,
            runId,
            sessionKey: input.sessionKey,
            startedAt,
        },
        {
            status: 'running',
            step: {
                completed_at: reasoning.timestamp,
                id: 'reasoning',
                kind: 'thinking',
                label: 'Reasoning',
                metadata: {
                    detail: reasoning.text,
                },
                started_at: reasoning.timestamp,
                status: 'completed',
            },
        }
    );
}

async function readLatestAssistantReasoning({ after, transcriptPath }) {
    const raw = await readFile(transcriptPath, 'utf8').catch(() => null);

    if (!raw) {
        return null;
    }

    const afterMs = Date.parse(after);
    let latest = null;

    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }

        let record;

        try {
            record = JSON.parse(line);
        } catch {
            continue;
        }

        const message = record?.message;

        if (!(message && typeof message === 'object' && message.role === 'assistant')) {
            continue;
        }

        const timestamp = readString(record.timestamp) ?? readString(message.timestamp);
        const timestampMs = timestamp ? Date.parse(timestamp) : Number.NaN;

        if (Number.isFinite(afterMs) && Number.isFinite(timestampMs) && timestampMs < afterMs) {
            continue;
        }

        const text = readAssistantReasoningText(message);

        if (text) {
            latest = {
                text,
                timestamp: timestamp ?? new Date().toISOString(),
            };
        }
    }

    return latest;
}

function readAssistantReasoningText(message) {
    const parts = Array.isArray(message.content) ? message.content : [];
    const text = parts
        .map((part) => {
            if (!(part && typeof part === 'object' && part.type === 'thinking')) {
                return null;
            }

            return (
                readString(part.thinking) ??
                readString(part.thinkingText) ??
                readString(part.text) ??
                readReasoningSignatureSummary(part.thinkingSignature)
            );
        })
        .filter(Boolean)
        .join('\n');

    return text.trim().length > 0 ? text : null;
}

function readReasoningSignatureSummary(value) {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    try {
        const parsed = JSON.parse(value);
        const summary = Array.isArray(parsed?.summary) ? parsed.summary : [];
        const text = summary
            .map((entry) => (entry && typeof entry === 'object' ? readString(entry.text) : null))
            .filter(Boolean)
            .join('\n');

        return text.trim().length > 0 ? text : null;
    } catch {
        return null;
    }
}

function parseTavernRelayInbound(event) {
    const message = event.message ?? {};
    const conversation = event.conversation ?? {};

    return {
        agentId: requireString(event.agentId, 'agentId'),
        chatId: requireString(conversation.id, 'conversation.id'),
        conversationKind: readConversationKind(conversation.kind),
        cursor: readPositiveInteger(event.cursor),
        messageId: requireString(message.id, 'message.id'),
        metadata: readRecord(message.metadata),
        nonce: readString(message.nonce),
        parentMessageId: readString(message.parentMessageId),
        sequence: readPositiveInteger(message.sequence),
        sentAt: readString(message.timestamp) ?? new Date().toISOString(),
        sessionKey: requireString(event.sessionKey, 'sessionKey'),
        text: requireString(message.text, 'message.text'),
        threadRootId: readString(message.threadRootId),
        turnId: readString(event.turnId),
        sender: {
            id: readString(message.senderId) ?? 'tavern-user',
            name: readString(message.senderName) ?? 'Tavern',
        },
        recentMessages: undefined,
    };
}

function createTurnTimingLogger() {
    return () => undefined;
}

function createTavernDeliveryAdapter({ cfg, context, input, markFinalReplySent, storePath }) {
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
                context,
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

function requireTavernApi(context) {
    if (!context?.tavern) {
        throw new Error('Tavern Messenger requires a Tavern API client.');
    }
    return context.tavern;
}

function readRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}

function readConversationKind(value) {
    return value === 'dm' || value === 'thread' ? value : 'channel';
}

function readPositiveInteger(value) {
    return Number.isInteger(value) && value > 0 ? value : undefined;
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
