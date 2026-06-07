import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildTavernOutboundSessionRoute } from './channel.js';
import { DEFAULT_ACCOUNT_ID, TAVERN_CHANNEL_ID } from './config.js';
import {
    persistAcceptedInboundMessage,
    persistDeliveredTurnMessage,
    persistFailedTurnMessages,
    readTranscriptSession,
} from './failed-inbound-message.js';
import { buildBodyForAgentWithMentions } from './mentions.js';
import { buildAcceptedTavernMetadata, registerActiveTavernTurn } from './message-identity.js';
import { registerTavernDeliveryContext, sendTavernTextMessage } from './outbound.js';
import { recordRuntimeNotice, splitOpenClawFinalPayload } from './runtime-notices.js';
import { activityStepFromProgressStep } from './tavern-api.js';
import { createTurnProgressMapper } from './turn-progress.js';

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
    const dispatchCfg = withTavernProgressCallbacksEnabled(cfg);
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
    const unregisterActiveTurn = registerActiveTavernTurn(input);
    const bodyForAgent = buildBodyForAgentWithMentions({
        metadata: acceptedMetadata,
        text: input.text,
    });
    const turnProgress = createTurnProgressMapper({
        context,
        input,
        runId,
        startedAt,
    });
    const channelInbound = resolveChannelInboundRuntime(runtime);
    const ctxPayload = channelInbound.buildContext({
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
            label: input.conversationLabel,
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
            ...(input.conversationLabel ? { ConversationLabel: input.conversationLabel } : {}),
            ...(input.groupSubject ? { GroupSubject: input.groupSubject } : {}),
            ...(input.groupChannel ? { GroupChannel: input.groupChannel } : {}),
            ...(input.groupSystemPrompt ? { GroupSystemPrompt: input.groupSystemPrompt } : {}),
            TavernMessageMetadata: acceptedMetadata,
        },
        message: {
            rawBody: input.text,
            bodyForAgent,
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
        requestMessageId: input.messageId,
        runId,
        sessionKey: input.sessionKey,
        startedAt,
    });

    let turnResult;
    try {
        timing('runAssembled.start');
        turnResult = await channelInbound.dispatchReply({
            agentId: input.agentId,
            channel: TAVERN_CHANNEL_ID,
            accountId: DEFAULT_ACCOUNT_ID,
            routeSessionKey: input.sessionKey,
            storePath,
            ctxPayload,
            cfg: dispatchCfg,
            dispatchReplyWithBufferedBlockDispatcher:
                runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher,
            delivery: createTavernDeliveryAdapter({
                cfg: dispatchCfg,
                context,
                input,
                markFinalReplySent: () => {
                    observedFinalReplyDelivery = true;
                },
                runId,
                startedAt,
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
                onApprovalEvent: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'approval' });
                    turnProgress.handle({
                        data: event,
                        stream: 'approval',
                    });
                },
                onCommandOutput: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'command_output' });
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
                onItemEvent: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'item' });
                    turnProgress.handle({
                        data: event,
                        stream: 'item',
                    });
                },
                onPatchSummary: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'patch' });
                    turnProgress.handle({
                        data: event,
                        stream: 'patch',
                    });
                },
                onPartialReply: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'partial_reply' });
                    turnProgress.handle({
                        data: event,
                        stream: 'partial_reply',
                    });
                },
                onReasoningStream: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'thinking' });
                    turnProgress.handle({
                        data: {
                            text: typeof event?.text === 'string' ? event.text : '',
                        },
                        stream: 'thinking',
                    });
                },
                onPlanUpdate: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'plan' });
                    turnProgress.handle({
                        data: event,
                        stream: 'plan',
                    });
                },
                onToolResult: (event) => {
                    recordTurnCallback({ data: event, input, runId, stream: 'tool_result' });
                    turnProgress.handle({
                        data: event,
                        stream: 'tool_result',
                    });
                },
                runId,
                shouldEmitToolOutput: () => true,
                shouldEmitToolResult: () => true,
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
        await updateTurnToolsFromTranscript({ context, input, runId, startedAt, storePath });
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

function withTavernProgressCallbacksEnabled(cfg) {
    return {
        ...cfg,
        agents: {
            ...cfg.agents,
            defaults: {
                ...cfg.agents?.defaults,
                verboseDefault: 'on',
            },
        },
    };
}

function resolveChannelInboundRuntime(runtime) {
    const inbound = runtime.channel?.inbound ?? runtime.channel?.turn;
    if (!(inbound?.buildContext && inbound?.dispatchReply)) {
        throw new Error('Tavern Messenger requires OpenClaw channel inbound runtime helpers.');
    }
    return inbound;
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
                ...activityStepFromProgressStep(
                    {
                        detail: reasoning.text,
                        id: 'reasoning',
                        kind: 'reasoning',
                        label: 'Reasoning',
                        status: 'completed',
                    },
                    reasoning.timestamp
                ),
                started_at: reasoning.timestamp,
            },
        }
    );
}

async function updateTurnToolsFromTranscript({ context, input, runId, startedAt, storePath }) {
    const session = await readTranscriptSession({ input, storePath });

    if (!session) {
        return;
    }

    const tools = await readTranscriptToolResults({
        after: input.sentAt,
        transcriptPath: session.transcriptPath,
    });

    for (const tool of tools) {
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
                    ...activityStepFromProgressStep(
                        {
                            arguments: tool.arguments,
                            detail: tool.resultText,
                            id: progressToolIdFromToolCallId(tool.toolCallId),
                            kind: 'tool',
                            label: buildTranscriptToolLabel(tool.name, tool.arguments),
                            result: tool.resultText,
                            status: tool.isError ? 'failed' : 'completed',
                            toolCallId: tool.toolCallId,
                            toolName: tool.name,
                        },
                        tool.timestamp
                    ),
                    started_at: tool.startedAt,
                },
            }
        );
    }
}

async function readTranscriptToolResults({ after, transcriptPath }) {
    const raw = await readFile(transcriptPath, 'utf8').catch(() => null);

    if (!raw) {
        return [];
    }

    const afterMs = Date.parse(after);
    const callsById = new Map();
    const results = [];

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
        const timestamp = readString(record?.timestamp) ?? readString(message?.timestamp);
        const timestampMs = timestamp ? Date.parse(timestamp) : Number.NaN;

        if (Number.isFinite(afterMs) && Number.isFinite(timestampMs) && timestampMs < afterMs) {
            continue;
        }

        if (message?.role === 'assistant') {
            for (const call of readToolCalls(message)) {
                callsById.set(call.id, {
                    ...call,
                    startedAt: timestamp ?? new Date().toISOString(),
                });
            }
            continue;
        }

        if (message?.role !== 'toolResult') {
            continue;
        }

        const toolCallId = readString(message.toolCallId);
        const call = toolCallId ? callsById.get(toolCallId) : null;

        if (!call) {
            continue;
        }

        results.push({
            arguments: call.arguments,
            isError: message.isError === true,
            name: call.name,
            resultText: readToolResultText(message),
            startedAt: call.startedAt,
            timestamp: timestamp ?? new Date().toISOString(),
            toolCallId,
        });
    }

    return results;
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

function readToolCalls(message) {
    const parts = Array.isArray(message.content) ? message.content : [];

    return parts
        .map((part) => {
            if (!(part && typeof part === 'object' && part.type === 'toolCall')) {
                return null;
            }

            const id = readString(part.id);
            const name = readString(part.name);

            if (!(id && name)) {
                return null;
            }

            return {
                arguments:
                    part.arguments &&
                    typeof part.arguments === 'object' &&
                    !Array.isArray(part.arguments)
                        ? part.arguments
                        : null,
                id,
                name,
            };
        })
        .filter(Boolean);
}

function readToolResultText(message) {
    const parts = Array.isArray(message.content) ? message.content : [];
    const text = parts
        .map((part) => {
            if (typeof part === 'string') {
                return part;
            }
            if (!(part && typeof part === 'object')) {
                return null;
            }
            return readString(part.text) ?? readString(part.content);
        })
        .filter(Boolean)
        .join('\n');

    return text.trim().length > 0 ? text : null;
}

function progressToolIdFromToolCallId(toolCallId) {
    return toolCallId;
}

function buildTranscriptToolLabel(name, args) {
    const target =
        args && typeof args === 'object' && !Array.isArray(args)
            ? (readString(args.path) ??
              readString(args.file_path) ??
              readString(args.filePath) ??
              readString(args.command) ??
              readString(args.query))
            : null;

    if (name === 'read' && target) {
        return `read from ${target}`;
    }

    return target ? `${name} ${target}` : name;
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

function readRecentMessages(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }

            const body = readString(entry.body);
            if (!body) {
                return null;
            }

            return {
                body,
                messageId: readString(entry.messageId) ?? undefined,
                sender: readString(entry.sender) ?? undefined,
                timestamp:
                    typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)
                        ? entry.timestamp
                        : undefined,
            };
        })
        .filter(Boolean);
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
        conversationLabel: readString(conversation.label),
        groupChannel: readString(conversation.groupChannel),
        groupSubject: readString(conversation.groupSubject),
        groupSystemPrompt: readString(conversation.groupSystemPrompt),
        sender: {
            id: readString(message.senderId) ?? 'tavern-user',
            name: readString(message.senderName) ?? 'Tavern',
        },
        recentMessages: readRecentMessages(event.recentMessages),
    };
}

function createTurnTimingLogger() {
    return () => undefined;
}

function createTavernDeliveryAdapter({
    cfg,
    context,
    input,
    markFinalReplySent,
    runId,
    startedAt,
    storePath,
}) {
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

            const { notices, text } = splitOpenClawFinalPayload(payload);
            for (const notice of notices) {
                await recordRuntimeNotice({
                    context,
                    input,
                    notice,
                    runId,
                    startedAt,
                });
            }

            if (!text.trim()) {
                return {
                    messageIds: [],
                    receipt: null,
                    visibleReplySent: false,
                };
            }

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
            const text =
                info.kind === 'final'
                    ? splitOpenClawFinalPayload(payload).text
                    : typeof payload?.text === 'string'
                      ? payload.text
                      : '';

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

function recordTurnCallback({ data, input, runId, stream }) {
    const logPath = process.env.TAVERN_OPENCLAW_TURN_EVENT_LOG;
    if (!logPath) {
        return;
    }

    const entry = {
        agentId: input.agentId,
        capturedAt: new Date().toISOString(),
        chatId: input.chatId,
        data,
        messageId: input.messageId,
        runId,
        sessionKey: input.sessionKey,
        stream,
    };

    void mkdir(path.dirname(logPath), { recursive: true })
        .then(() => appendFile(logPath, `${JSON.stringify(entry)}\n`))
        .catch(() => undefined);
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
