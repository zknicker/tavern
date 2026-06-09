import type { AgentRuntimeSessionMessageAttachment } from '@tavern/api';
import { readConfigValue } from '../config';
import { createLocalHermesClient } from '../hermes/local-client';
import { createDelivery, upsertResponse, upsertResponseActivity } from './chat-api';
import { createAgentParticipantId } from './chat-api/ids';
import { publishRuntimeEvent } from './runtime-events';

const activeHermesTurns = new Map<string, { sessionId: string | null }>();

export async function runHermesTurn(input: {
    agentId: string;
    attachments?: AgentRuntimeSessionMessageAttachment[];
    chatId: string;
    content: string;
    modelRef?: string;
    requestMessageId: string;
    responseId: string;
    runId: string;
    sessionKey: string;
}) {
    const client = createLocalHermesClient();
    const participantId = createAgentParticipantId(input.agentId);
    const startedAt = new Date().toISOString();
    const turn = {
        agentId: input.agentId,
        chatId: input.chatId,
        runId: input.runId,
        sessionKey: input.sessionKey,
        startedAt,
    };
    let assistantContent = '';
    let assistantMessageId: string | null = null;
    let modelContext = resolveTurnModelContext();
    let assistantSegment: AssistantSegment | null = null;
    let assistantSegmentIndex = 0;
    const progressMessages: string[] = [];
    let reasoningSegment: ReasoningSegment | null = null;
    let reasoningSegmentIndex = 0;
    const completedReasoningMessages: string[] = [];
    const activeTurn = { sessionId: null as string | null };
    activeHermesTurns.set(input.runId, activeTurn);

    try {
        publishRuntimeEvent({ timestamp: startedAt, turn, type: 'turn.started' });

        for await (const event of client.streamChat({
            attachments: input.attachments,
            content: input.content,
            modelRef: input.modelRef,
            onLiveSessionId: (sessionId) => {
                activeTurn.sessionId = sessionId;
            },
            sessionKey: input.sessionKey,
            title: input.chatId,
        })) {
            if (!isReasoningEvent(event.event)) {
                collectCompletedReasoning(
                    completedReasoningMessages,
                    completeReasoningSegment(input, reasoningSegment)
                );
                reasoningSegment = null;
            }

            if (event.event === 'assistant.delta') {
                const delta = readString(event.data.delta) ?? '';
                assistantContent += delta;
                if (delta) {
                    if (!assistantSegment) {
                        assistantSegmentIndex += 1;
                        assistantSegment = {
                            content: '',
                            index: assistantSegmentIndex,
                            startedAt: new Date().toISOString(),
                        };
                    }
                    assistantSegment.content += delta;
                }
                publishRuntimeEvent({
                    delta,
                    isThinking: false,
                    text: assistantContent,
                    timestamp: new Date().toISOString(),
                    turn,
                    type: 'turn.replyUpdated',
                });
                continue;
            }

            if (event.event === 'session.info') {
                modelContext = mergeModelContext(modelContext, event.data);
                continue;
            }

            if (event.event === 'tool.progress') {
                collectProgressMessage(
                    progressMessages,
                    flushAssistantSegment(input, turn, assistantSegment)
                );
                assistantSegment = null;
                recordToolProgress(input, turn, event);
                continue;
            }

            if (event.event === 'reasoning.delta') {
                collectProgressMessage(
                    progressMessages,
                    flushAssistantSegment(input, turn, assistantSegment)
                );
                assistantSegment = null;
                const delta = readString(event.data.delta) ?? '';
                if (!delta) {
                    continue;
                }
                if (!reasoningSegment) {
                    reasoningSegmentIndex += 1;
                    reasoningSegment = {
                        content: '',
                        index: reasoningSegmentIndex,
                        startedAt: new Date().toISOString(),
                    };
                }
                reasoningSegment.content += delta;
                recordReasoningProgress(input, turn, reasoningSegment);
                continue;
            }

            if (isToolLifecycleEvent(event.event)) {
                collectProgressMessage(
                    progressMessages,
                    flushAssistantSegment(input, turn, assistantSegment)
                );
                assistantSegment = null;
                recordToolLifecycle(input, turn, event);
                continue;
            }

            if (event.event === 'assistant.status') {
                collectProgressMessage(
                    progressMessages,
                    flushAssistantSegment(input, turn, assistantSegment)
                );
                assistantSegment = null;
                recordAssistantStatus(input, turn, event);
                continue;
            }

            if (event.event === 'assistant.completed') {
                const completedContent = readString(event.data.content) || assistantContent;
                const completedReasoning = readString(event.data.reasoning);
                const deliveredContent = removeProgressMessages(completedContent, progressMessages);
                if (
                    completedReasoning &&
                    !isSameProgressText(completedReasoning, deliveredContent) &&
                    !hasCompletedReasoning(completedReasoning, completedReasoningMessages)
                ) {
                    reasoningSegmentIndex += 1;
                    const finalReasoning = {
                        content: completedReasoning,
                        index: reasoningSegmentIndex,
                        startedAt: new Date().toISOString(),
                    };
                    recordReasoningProgress(input, turn, finalReasoning, 'message.complete');
                    collectCompletedReasoning(
                        completedReasoningMessages,
                        completeReasoningSegment(input, finalReasoning, 'message.complete')
                    );
                }
                assistantContent = deliveredContent;
                assistantMessageId = readString(event.data.message_id);
                modelContext = mergeModelContext(modelContext, event.data);
            }

            if (event.event === 'error') {
                throw new Error(readString(event.data.message) || 'Hermes stream failed.');
            }
        }
        collectCompletedReasoning(
            completedReasoningMessages,
            completeReasoningSegment(input, reasoningSegment)
        );
        reasoningSegment = null;

        if (!assistantContent.trim()) {
            throw new Error('Hermes turn ended before producing a reply.');
        }

        completeHermesTurn(
            input,
            participantId,
            assistantContent,
            assistantMessageId,
            turn,
            modelContext
        );
    } catch (error) {
        completeReasoningSegment(input, reasoningSegment);
        reasoningSegment = null;
        failHermesTurn(input, participantId, error, turn);
    } finally {
        activeHermesTurns.delete(input.runId);
        client.close();
    }
}

export async function interruptHermesTurn(runId: string) {
    const activeTurn = activeHermesTurns.get(runId);

    if (!activeTurn?.sessionId) {
        return false;
    }

    const client = createLocalHermesClient();
    try {
        await client.interruptLiveSession(activeTurn.sessionId);
        return true;
    } finally {
        client.close();
    }
}

interface HermesTurn {
    agentId: string;
    chatId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
}

interface HermesEvent {
    data: Record<string, unknown>;
    event: string;
}

interface ReasoningSegment {
    content: string;
    index: number;
    startedAt: string;
}

interface AssistantSegment {
    content: string;
    index: number;
    startedAt: string;
}

interface HermesModelContext {
    model: string | null;
    provider: string | null;
    usage: Record<string, number> | null;
}

type HermesTurnInput = Parameters<typeof runHermesTurn>[0];

function recordToolProgress(input: HermesTurnInput, turn: HermesTurn, event: HermesEvent) {
    const toolCallId = readString(event.data.tool_call_id);
    const toolName = readString(event.data.tool_name) || 'tool';
    const detail = readString(event.data.delta);

    if (!detail?.trim()) {
        return;
    }

    if (!toolCallId) {
        recordAssistantProgressMessage(input, turn, {
            detail,
            source: readString(event.data.source_event) ?? event.event,
            title: toolName,
        });
        return;
    }

    const id = createActivityId(input.runId, toolCallId);

    upsertResponseActivity(input.chatId, input.responseId, {
        detail,
        id,
        kind: 'tool_call',
        metadata: {
            event: event.event,
            runtime: runtimeMetadata(input, { toolCallId, toolName }),
            tool: {
                arguments: {},
                name: toolName,
                result: null,
            },
        },
        status: 'running',
        title: toolName,
    });
    publishRuntimeEvent({
        step: {
            detail,
            id,
            kind: 'tool',
            label: toolName,
            status: 'active',
            toolCallId,
            toolName,
        },
        timestamp: new Date().toISOString(),
        turn,
        type: 'turn.progress',
    });
}

function recordAssistantStatus(input: HermesTurnInput, turn: HermesTurn, event: HermesEvent) {
    const detail = readString(event.data.delta);

    if (!detail?.trim()) {
        return;
    }

    recordAssistantProgressMessage(input, turn, {
        detail,
        source: readString(event.data.source_event) ?? event.event,
        title: 'Assistant update',
    });
}

function flushAssistantSegment(
    input: HermesTurnInput,
    turn: HermesTurn,
    segment: AssistantSegment | null
): string | null {
    if (!segment?.content.trim()) {
        return null;
    }

    recordAssistantProgressMessage(input, turn, {
        detail: segment.content,
        idSuffix: `message_${segment.index}`,
        source: 'message.delta',
        startedAt: segment.startedAt,
        title: 'Assistant update',
    });

    return segment.content.trim();
}

function recordAssistantProgressMessage(
    input: HermesTurnInput,
    turn: HermesTurn,
    output: {
        detail: string;
        idSuffix?: string;
        source: string;
        startedAt?: string;
        title: string;
    }
) {
    const detail = output.detail.trim();

    if (!detail) {
        return;
    }

    const id = createActivityId(
        input.runId,
        output.idSuffix ?? `message_${stableActivitySuffix(detail)}`
    );
    const startedAt = output.startedAt ?? new Date().toISOString();

    upsertResponseActivity(input.chatId, input.responseId, {
        detail,
        id,
        kind: 'message',
        metadata: {
            event: output.source,
            runtime: runtimeMetadata(input),
        },
        started_at: startedAt,
        status: 'running',
        title: output.title,
    });
    publishRuntimeEvent({
        step: {
            detail,
            id,
            kind: 'message',
            label: output.title,
            status: 'active',
        },
        timestamp: startedAt,
        turn,
        type: 'turn.progress',
    });
}

function recordReasoningProgress(
    input: HermesTurnInput,
    turn: HermesTurn,
    segment: ReasoningSegment,
    sourceEvent = 'reasoning.delta'
) {
    if (!segment.content.trim()) {
        return;
    }

    const id = createActivityId(input.runId, `thinking_${segment.index}`);
    const label = 'Thinking';

    upsertResponseActivity(input.chatId, input.responseId, {
        detail: segment.content,
        id,
        kind: 'reasoning',
        metadata: { event: sourceEvent, runtime: runtimeMetadata(input) },
        started_at: segment.startedAt,
        status: 'running',
        title: label,
    });
    publishRuntimeEvent({
        step: { detail: segment.content, id, kind: 'reasoning', label, status: 'active' },
        timestamp: new Date().toISOString(),
        turn,
        type: 'turn.progress',
    });
}

function completeReasoningSegment(
    input: HermesTurnInput,
    segment: ReasoningSegment | null,
    sourceEvent = 'reasoning.delta'
) {
    if (!segment?.content.trim()) {
        return null;
    }

    upsertResponseActivity(input.chatId, input.responseId, {
        completed_at: new Date().toISOString(),
        detail: segment.content,
        id: createActivityId(input.runId, `thinking_${segment.index}`),
        kind: 'reasoning',
        metadata: { event: sourceEvent, runtime: runtimeMetadata(input) },
        started_at: segment.startedAt,
        status: 'completed',
        title: 'Thinking',
    });
    return segment.content;
}

function recordToolLifecycle(input: HermesTurnInput, turn: HermesTurn, event: HermesEvent) {
    const toolName = readString(event.data.tool_name) || 'tool';
    const toolCallId = readString(event.data.tool_call_id);
    const id = createActivityId(input.runId, toolCallId ?? toolName);
    const detail = readString(event.data.preview);
    const status =
        event.event === 'tool.failed'
            ? 'failed'
            : event.event === 'tool.completed'
              ? 'completed'
              : 'running';

    upsertResponseActivity(input.chatId, input.responseId, {
        detail,
        id,
        kind: 'tool_call',
        metadata: {
            event: event.event,
            runtime: runtimeMetadata(input, { toolCallId, toolName }),
            tool: {
                arguments: event.data.arguments ?? {},
                name: toolName,
                result: event.data.result ?? null,
            },
        },
        status,
        title: toolName,
    });
    publishRuntimeEvent({
        step: {
            detail,
            id,
            kind: 'tool',
            label: toolName,
            status: status === 'running' ? 'active' : status,
            toolCallId,
            toolName,
        },
        timestamp: new Date().toISOString(),
        turn,
        type: 'turn.progress',
    });
}

function completeHermesTurn(
    input: HermesTurnInput,
    participantId: string,
    assistantContent: string,
    assistantMessageId: string | null,
    turn: HermesTurn,
    modelContext: HermesModelContext
) {
    const delivery = createDelivery(input.chatId, {
        agent_id: participantId,
        id: createDeliveryId(input.runId),
        message: {
            author_id: participantId,
            content: assistantContent,
            id: createAssistantMessageId(input.runId, assistantMessageId),
            metadata: {
                ...messageModelMetadata(modelContext),
                runtime: {
                    agentId: input.agentId,
                    hermesMessageId: assistantMessageId,
                    runId: input.runId,
                    sessionKey: input.sessionKey,
                    source: 'hermes',
                    startedAt: turn.startedAt,
                },
            },
            role: 'assistant',
        },
        metadata: {
            runtime: { runId: input.runId, sessionKey: input.sessionKey, source: 'hermes' },
        },
        turn_id: input.runId,
    });

    upsertResponse(input.chatId, {
        id: input.responseId,
        metadata: {
            runtime: {
                agentId: input.agentId,
                messageId: input.requestMessageId,
                runId: input.runId,
                sessionKey: input.sessionKey,
                source: 'hermes',
                startedAt: turn.startedAt,
            },
        },
        participant_id: participantId,
        request_message_id: input.requestMessageId,
        response_message_id: delivery.message.id,
        status: 'completed',
    });
    publishRuntimeEvent({ timestamp: new Date().toISOString(), turn, type: 'turn.completed' });
}

function resolveTurnModelContext(): HermesModelContext {
    return {
        model: readConfigValue('TAVERN_HERMES_MODEL') ?? readConfigValue('CODEX_MODEL'),
        provider:
            readConfigValue('TAVERN_HERMES_PROVIDER') ??
            (readConfigValue('OPENROUTER_API_KEY') && !readConfigValue('OPENAI_API_KEY')
                ? 'openrouter'
                : 'openai-codex'),
        usage: null,
    };
}

function mergeModelContext(
    current: HermesModelContext,
    data: Record<string, unknown>
): HermesModelContext {
    return {
        model: readString(data.model) ?? current.model,
        provider: readString(data.provider) ?? current.provider,
        usage: normalizeUsage(data.usage) ?? current.usage,
    };
}

function messageModelMetadata(context: HermesModelContext) {
    return {
        ...(context.model ? { hermesModel: context.model } : {}),
        ...(context.provider ? { hermesProvider: context.provider } : {}),
        ...(context.model && context.provider
            ? { model: context.model, provider: context.provider }
            : {}),
        ...(context.usage ? { usage: context.usage } : {}),
    };
}

function normalizeUsage(value: unknown): Record<string, number> | null {
    if (!(value && typeof value === 'object' && !Array.isArray(value))) {
        return null;
    }

    const record = value as Record<string, unknown>;
    const usage = {
        cacheRead: readNumber(record.cacheRead) ?? readNumber(record.cache_read),
        cacheWrite: readNumber(record.cacheWrite) ?? readNumber(record.cache_write),
        input:
            readNumber(record.input) ??
            readNumber(record.prompt) ??
            readNumber(record.promptTokens) ??
            readNumber(record.prompt_tokens),
        output:
            readNumber(record.output) ??
            readNumber(record.completion) ??
            readNumber(record.completionTokens) ??
            readNumber(record.completion_tokens),
        reasoning: readNumber(record.reasoning),
        total:
            readNumber(record.total) ??
            readNumber(record.totalTokens) ??
            readNumber(record.total_tokens),
    };
    const entries = Object.entries(usage).filter((entry): entry is [string, number] => {
        const [, count] = entry;
        return typeof count === 'number' && Number.isFinite(count) && count > 0;
    });

    return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function failHermesTurn(
    input: HermesTurnInput,
    participantId: string,
    error: unknown,
    turn: HermesTurn
) {
    const message = error instanceof Error ? error.message : String(error);
    upsertResponse(input.chatId, {
        id: input.responseId,
        metadata: {
            error: message,
            runtime: {
                agentId: input.agentId,
                error: message,
                messageId: input.requestMessageId,
                runId: input.runId,
                sessionKey: input.sessionKey,
                source: 'hermes',
                startedAt: turn.startedAt,
            },
        },
        participant_id: participantId,
        request_message_id: input.requestMessageId,
        status: 'failed',
    });
    publishRuntimeEvent({
        error: message,
        timestamp: new Date().toISOString(),
        turn,
        type: 'turn.failed',
    });
    console.warn('[tavern-runtime] Hermes turn failed', error);
}

function isToolLifecycleEvent(event: string) {
    return event === 'tool.started' || event === 'tool.completed' || event === 'tool.failed';
}

function isReasoningEvent(event: string) {
    return event === 'reasoning.delta';
}

function createAssistantMessageId(runId: string, hermesMessageId: string | null) {
    return `msg_${sanitizeId(hermesMessageId ?? `${runId}_assistant`)}`;
}

function createDeliveryId(runId: string) {
    return `del_${sanitizeId(runId)}`;
}

function createActivityId(runId: string, key: string) {
    return `act_${sanitizeActivityId(`${runId}_${key}`)}`;
}

function stableActivitySuffix(value: string) {
    let hash = 5381;
    for (const character of value) {
        hash = (hash * 33) ^ character.charCodeAt(0);
    }
    return Math.abs(hash >>> 0).toString(36);
}

function collectProgressMessage(messages: string[], message: string | null) {
    if (message) {
        messages.push(message);
    }
}

function collectCompletedReasoning(messages: string[], message: string | null) {
    if (message) {
        messages.push(message);
    }
}

function removeProgressMessages(value: string, progressMessages: string[]) {
    let next = value;

    for (const message of progressMessages) {
        next = removeProgressPrefix(next, message);
    }

    return next.trim();
}

function removeProgressPrefix(value: string, prefix: string) {
    const normalizedValue = value.trimStart();
    const normalizedPrefix = prefix.trim();

    if (!(normalizedPrefix && normalizedValue.startsWith(normalizedPrefix))) {
        return value;
    }

    return normalizedValue.slice(normalizedPrefix.length).trimStart();
}

function isSameProgressText(left: string, right: string) {
    const normalizedLeft = normalizeProgressText(left);
    const normalizedRight = normalizeProgressText(right);

    return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

function hasCompletedReasoning(content: string, completedMessages: string[]) {
    return (
        completedMessages.some((message) => isSameProgressText(content, message)) ||
        isSameProgressText(content, completedMessages.join('\n'))
    );
}

function normalizeProgressText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
}

function sanitizeId(value: string) {
    return value.replace(/^(msg|run|rsp|del|act)_/iu, '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function sanitizeActivityId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function runtimeMetadata(
    input: HermesTurnInput,
    extra: { toolCallId?: string | null; toolName?: string | null } = {}
) {
    return {
        agentId: input.agentId,
        runId: input.runId,
        sessionKey: input.sessionKey,
        source: 'hermes',
        ...extra,
    };
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
