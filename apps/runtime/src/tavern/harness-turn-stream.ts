import type { AgentRuntimeModelName } from '@tavern/api';
import { upsertResponseActivity } from './chat-api/index.ts';

export const assistantCommentaryPhase = 'commentary' as const;
export const assistantFinalAnswerPhase = 'final_answer' as const;

export type HarnessAssistantMessagePhase =
    | typeof assistantCommentaryPhase
    | typeof assistantFinalAnswerPhase;

export interface HarnessTurnStreamTarget {
    chatId: string;
    model: AgentRuntimeModelName;
    responseId: string;
    runId: string;
    runtime: Record<string, unknown>;
}

export interface HarnessTurnStreamOutcome {
    activityIds: string[];
    /** Last streamed text segment; the turn's reply. Empty when none streamed. */
    finalText: string;
}

/**
 * Consumes a harness turn's part stream and persists response activity while
 * the turn is still running, so the app's thinking indicator updates live:
 * tool calls upsert as `running` when they start and `completed`/`failed`
 * when they resolve, and a text segment persists as commentary the moment a
 * later part proves it is not the final answer.
 */
export async function persistHarnessTurnStream(
    target: HarnessTurnStreamTarget,
    stream: AsyncIterable<unknown>
): Promise<HarnessTurnStreamOutcome> {
    const state = createStreamState();

    try {
        for await (const part of stream) {
            handleStreamPart(target, state, part);
        }
    } catch (error) {
        flushInterruptedBuffers(target, state);
        throw error;
    }

    if (state.streamError !== undefined) {
        flushInterruptedBuffers(target, state);
        throw toStreamError(state.streamError);
    }
    if (state.aborted) {
        flushInterruptedBuffers(target, state);
        throw new Error('Agent turn was aborted before completion.');
    }

    return {
        activityIds: state.activityIds,
        finalText: state.pendingText?.content ?? '',
    };
}

interface PendingText {
    content: string;
    contentIndex: number;
    startedAt: string;
}

interface StreamState {
    aborted: boolean;
    activityIds: string[];
    pendingText: PendingText | null;
    reasoningBuffers: Map<string, { content: string; startedAt: string }>;
    reasoningIndex: number;
    streamError: unknown;
    textBuffers: Map<string, { content: string; startedAt: string }>;
    textIndex: number;
    tools: Map<string, { activityId: string; startedAt: string }>;
}

function createStreamState(): StreamState {
    return {
        aborted: false,
        activityIds: [],
        pendingText: null,
        reasoningBuffers: new Map(),
        reasoningIndex: 0,
        streamError: undefined,
        textBuffers: new Map(),
        textIndex: 0,
        tools: new Map(),
    };
}

function handleStreamPart(target: HarnessTurnStreamTarget, state: StreamState, part: unknown) {
    if (!isStreamPart(part)) {
        return;
    }
    switch (part.type) {
        case 'text-start':
            handleTextStart(state, part);
            return;
        case 'text-delta':
            handleTextDelta(state, part);
            return;
        case 'text-end':
            handleTextEnd(target, state, part);
            return;
        case 'reasoning-start':
            handleReasoningStart(state, part);
            return;
        case 'reasoning-delta':
            handleReasoningDelta(state, part);
            return;
        case 'reasoning-end':
            handleReasoningEnd(target, state, part);
            return;
        case 'tool-call':
            handleToolCall(target, state, part);
            return;
        case 'tool-result':
            handleToolResult(target, state, part);
            return;
        case 'tool-error':
            handleToolError(target, state, part);
            return;
        case 'error':
            state.streamError ??=
                (part as { error?: unknown }).error ?? new Error('Harness stream failed.');
            return;
        case 'abort':
            state.aborted = true;
            return;
        default:
            return;
    }
}

function handleTextStart(state: StreamState, part: { type: string } & Record<string, unknown>) {
    if (typeof part.id !== 'string') {
        return;
    }
    state.textBuffers.set(part.id, { content: '', startedAt: nowIso() });
}

function handleTextDelta(state: StreamState, part: { type: string } & Record<string, unknown>) {
    if (typeof part.id !== 'string' || typeof part.text !== 'string') {
        return;
    }
    const buffer = state.textBuffers.get(part.id);
    if (buffer) {
        buffer.content += part.text;
    }
}

function handleTextEnd(
    target: HarnessTurnStreamTarget,
    state: StreamState,
    part: { type: string } & Record<string, unknown>
) {
    if (typeof part.id !== 'string') {
        return;
    }
    const buffer = state.textBuffers.get(part.id);
    state.textBuffers.delete(part.id);
    const content = buffer?.content.trim();
    if (!(buffer && content)) {
        return;
    }
    flushPendingCommentary(target, state);
    state.pendingText = {
        content,
        contentIndex: state.textIndex,
        startedAt: buffer.startedAt,
    };
    state.textIndex += 1;
}

function handleReasoningStart(
    state: StreamState,
    part: { type: string } & Record<string, unknown>
) {
    if (typeof part.id !== 'string') {
        return;
    }
    state.reasoningBuffers.set(part.id, { content: '', startedAt: nowIso() });
}

function handleReasoningDelta(
    state: StreamState,
    part: { type: string } & Record<string, unknown>
) {
    if (typeof part.id !== 'string' || typeof part.text !== 'string') {
        return;
    }
    const buffer = state.reasoningBuffers.get(part.id);
    if (buffer) {
        buffer.content += part.text;
    }
}

function handleReasoningEnd(
    target: HarnessTurnStreamTarget,
    state: StreamState,
    part: { type: string } & Record<string, unknown>
) {
    if (typeof part.id !== 'string') {
        return;
    }
    const buffer = state.reasoningBuffers.get(part.id);
    state.reasoningBuffers.delete(part.id);
    const content = buffer?.content.trim();
    if (!(buffer && content)) {
        return;
    }
    flushPendingCommentary(target, state);
    const activityId = reasoningActivityIdForRun(target.runId, state.reasoningIndex);
    state.reasoningIndex += 1;
    state.activityIds.push(activityId);
    upsertResponseActivity(target.chatId, target.responseId, {
        completed_at: nowIso(),
        detail: content,
        id: activityId,
        kind: 'reasoning',
        metadata: {
            runtime: { ...target.runtime, model: target.model },
        },
        started_at: buffer.startedAt,
        status: 'completed',
        summary: content,
        title: 'Reasoning',
    });
}

function handleToolCall(
    target: HarnessTurnStreamTarget,
    state: StreamState,
    part: { type: string } & Record<string, unknown>
) {
    const toolCall = asToolPart(part);
    if (!toolCall) {
        return;
    }
    flushPendingCommentary(target, state);
    const startedAt = nowIso();
    const activityId = toolActivityIdForRun(target.runId, toolCall.toolCallId);
    state.tools.set(toolCall.toolCallId, { activityId, startedAt });
    state.activityIds.push(activityId);
    upsertResponseActivity(target.chatId, target.responseId, {
        detail: toolActivityDetail(toolCall.toolName, toolCall.input),
        id: activityId,
        kind: 'tool_call',
        metadata: {
            runtime: { ...target.runtime, model: target.model },
            tool: {
                arguments: toolCall.input,
                name: toolCall.toolName,
            },
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
        },
        started_at: startedAt,
        status: 'running',
        title: toolActivityTitle(toolCall.toolName, toolCall.input, toolCall.title),
    });
}

function handleToolResult(
    target: HarnessTurnStreamTarget,
    state: StreamState,
    part: { type: string } & Record<string, unknown>
) {
    const toolResult = asToolPart(part);
    if (!toolResult) {
        return;
    }
    const tool = state.tools.get(toolResult.toolCallId);
    const startedAt = tool?.startedAt ?? nowIso();
    const activityId =
        tool?.activityId ?? toolActivityIdForRun(target.runId, toolResult.toolCallId);
    if (!tool) {
        state.activityIds.push(activityId);
    }
    upsertResponseActivity(target.chatId, target.responseId, {
        completed_at: nowIso(),
        detail: toolActivityDetail(toolResult.toolName, toolResult.input),
        id: activityId,
        kind: 'tool_call',
        metadata: {
            runtime: { ...target.runtime, model: target.model },
            tool: {
                arguments: toolResult.input,
                name: toolResult.toolName,
                result: part.output,
            },
            toolCallId: toolResult.toolCallId,
            toolName: toolResult.toolName,
        },
        started_at: startedAt,
        status: 'completed',
        title: toolActivityTitle(toolResult.toolName, toolResult.input, toolResult.title),
    });
}

function handleToolError(
    target: HarnessTurnStreamTarget,
    state: StreamState,
    part: { type: string } & Record<string, unknown>
) {
    const toolError = asToolPart(part);
    if (!toolError) {
        return;
    }
    const tool = state.tools.get(toolError.toolCallId);
    const startedAt = tool?.startedAt ?? nowIso();
    const activityId = tool?.activityId ?? toolActivityIdForRun(target.runId, toolError.toolCallId);
    if (!tool) {
        state.activityIds.push(activityId);
    }
    upsertResponseActivity(target.chatId, target.responseId, {
        completed_at: nowIso(),
        detail: toolActivityDetail(toolError.toolName, toolError.input),
        id: activityId,
        kind: 'tool_call',
        metadata: {
            runtime: { ...target.runtime, model: target.model },
            tool: {
                arguments: toolError.input,
                error: streamErrorMessage(part.error),
                name: toolError.toolName,
            },
            toolCallId: toolError.toolCallId,
            toolName: toolError.toolName,
        },
        started_at: startedAt,
        status: 'failed',
        title: toolActivityTitle(toolError.toolName, toolError.input, toolError.title),
    });
}

// A stopped or failed stream keeps its evidence: everything buffered — the
// pending text, half-streamed segments, and open reasoning — persists before
// the error propagates, so the chat shows what the turn already produced.
function flushInterruptedBuffers(target: HarnessTurnStreamTarget, state: StreamState) {
    for (const id of [...state.reasoningBuffers.keys()]) {
        handleReasoningEnd(target, state, { id, type: 'reasoning-end' });
    }

    flushPendingCommentary(target, state);

    for (const id of [...state.textBuffers.keys()]) {
        handleTextEnd(target, state, { id, type: 'text-end' });
        flushPendingCommentary(target, state);
    }
}

function flushPendingCommentary(target: HarnessTurnStreamTarget, state: StreamState) {
    const pending = state.pendingText;
    if (!pending) {
        return;
    }
    state.pendingText = null;
    const activityId = messageActivityIdForRun(target.runId, pending.contentIndex);
    state.activityIds.push(activityId);
    upsertResponseActivity(target.chatId, target.responseId, {
        completed_at: nowIso(),
        detail: pending.content,
        id: activityId,
        kind: 'message',
        metadata: {
            runtime: {
                ...target.runtime,
                contentIndex: pending.contentIndex,
                messagePhase: assistantCommentaryPhase,
                model: target.model,
            },
        },
        started_at: pending.startedAt,
        status: 'completed',
        summary: pending.content,
        title: 'Agent commentary',
    });
}

export function toolActivityIdForRun(runId: string, toolCallId: string) {
    return `act_${sanitizeId(runId)}_tool_${sanitizeId(toolCallId)}`;
}

export function messageActivityIdForRun(runId: string, contentIndex: number) {
    return `act_${sanitizeId(runId)}_message_${contentIndex}`;
}

export function reasoningActivityIdForRun(runId: string, reasoningIndex: number) {
    return `act_${sanitizeId(runId)}_reasoning_${reasoningIndex}`;
}

function sanitizeId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function toolActivityTitle(toolName: string, input: unknown, title?: string) {
    if (title) {
        return title;
    }
    const subject = toolActivitySubject(toolName, input);
    return subject ?? `Used ${toolName}`;
}

function toolActivityDetail(toolName: string, input: unknown) {
    const record = isRecord(input) ? input : {};
    if (toolName === 'bash' && typeof record.command === 'string') {
        return record.command;
    }
    if ((toolName === 'read' || toolName === 'read_file') && typeof record.file_path === 'string') {
        return record.file_path;
    }
    return undefined;
}

function toolActivitySubject(toolName: string, input: unknown) {
    const record = isRecord(input) ? input : {};
    if (toolName === 'bash' && typeof record.command === 'string') {
        return 'terminal';
    }
    if ((toolName === 'read' || toolName === 'read_file') && typeof record.file_path === 'string') {
        return record.file_path;
    }
    return null;
}

interface ToolStreamPart {
    input: unknown;
    title?: string;
    toolCallId: string;
    toolName: string;
}

function asToolPart(part: Record<string, unknown>): ToolStreamPart | null {
    if (typeof part.toolCallId !== 'string' || typeof part.toolName !== 'string') {
        return null;
    }
    return {
        input: part.input,
        ...(typeof part.title === 'string' ? { title: part.title } : {}),
        toolCallId: part.toolCallId,
        toolName: part.toolName,
    };
}

function isStreamPart(part: unknown): part is { type: string } & Record<string, unknown> {
    return isRecord(part) && typeof part.type === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStreamError(error: unknown) {
    if (error instanceof Error) {
        return error;
    }
    return new Error(streamErrorMessage(error));
}

function streamErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return String(error);
}

function nowIso() {
    return new Date().toISOString();
}
