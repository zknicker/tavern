import type { AgentRuntimeSessionGraph } from '@tavern/api';

export type ToolCallRecord = AgentRuntimeSessionGraph['toolCalls'][number];

export interface ToolCallMessageSource {
    content: string;
    id: string;
    metadata?: {
        isError?: boolean | null;
        parts?: unknown;
        toolCallId?: string | null;
        toolName?: string | null;
    } | null;
    sender: string;
    senderName?: string | null;
    senderType: string;
    sessionKey: string;
    timestamp: string;
}

export function mergeToolCalls(input: {
    messages: ToolCallMessageSource[];
    toolCalls: ToolCallRecord[];
}) {
    const records = new Map(input.toolCalls.map((toolCall) => [toolCall.id, toolCall]));
    const existingCallKeys = new Set(
        input.toolCalls.map((toolCall) => getToolCallKey(toolCall)).filter(Boolean)
    );

    for (const toolCall of buildToolCallsFromMessages(input.messages)) {
        const callKey = getToolCallKey(toolCall);

        if (callKey && existingCallKeys.has(callKey)) {
            continue;
        }

        records.set(toolCall.id, toolCall);
    }

    return [...records.values()];
}

export function buildToolCallsFromMessages(messages: ToolCallMessageSource[]) {
    const records = new Map<string, ToolCallRecord>();
    const pendingCallIds: string[] = [];

    for (const message of messages) {
        for (const part of getToolCallParts(message.metadata?.parts)) {
            const toolCallId = readString(part.id) ?? readString(part.toolCallId);

            if (!toolCallId) {
                continue;
            }

            records.set(toolCallId, {
                arguments: typeof part.arguments === 'undefined' ? null : part.arguments,
                childSessionKey: null,
                finishedAt: null,
                id: buildToolCallId(message.sessionKey, toolCallId),
                isError: null,
                messageId: message.id,
                result: null,
                sessionKey: message.sessionKey,
                startedAt: message.timestamp,
                toolCallId,
                toolName: readString(part.name) ?? readString(part.toolName) ?? 'unknown',
            });
            pendingCallIds.push(toolCallId);
        }

        if (!isToolResultMessage(message)) {
            continue;
        }

        const toolCallId = message.metadata?.toolCallId ?? pendingCallIds.at(-1);

        if (!toolCallId) {
            continue;
        }

        const existing = records.get(toolCallId);
        const result = parseToolResult(message.content);
        const resultRecord = isRecord(result) ? result : null;

        records.set(toolCallId, {
            arguments: existing?.arguments ?? null,
            childSessionKey: readString(resultRecord?.childSessionKey ?? resultRecord?.sessionKey),
            finishedAt: message.timestamp,
            id: existing?.id ?? buildToolCallId(message.sessionKey, toolCallId),
            isError: message.metadata?.isError ?? existing?.isError ?? null,
            messageId: existing?.messageId ?? message.id,
            result,
            sessionKey: existing?.sessionKey ?? message.sessionKey,
            startedAt: existing?.startedAt ?? message.timestamp,
            toolCallId,
            toolName: message.metadata?.toolName ?? existing?.toolName ?? 'unknown',
        });

        const pendingIndex = pendingCallIds.lastIndexOf(toolCallId);

        if (pendingIndex >= 0) {
            pendingCallIds.splice(pendingIndex, 1);
        }
    }

    return [...records.values()];
}

function buildToolCallId(sessionKey: string, toolCallId: string) {
    return `${sessionKey}:tool:${toolCallId}`;
}

function getToolCallKey(toolCall: ToolCallRecord) {
    return toolCall.toolCallId ? `${toolCall.sessionKey}:${toolCall.toolCallId}` : null;
}

function getToolCallParts(parts: unknown) {
    return Array.isArray(parts)
        ? parts.filter((part): part is Record<string, unknown> => {
              return isRecord(part) && part.type === 'toolCall';
          })
        : [];
}

function isToolResultMessage(message: ToolCallMessageSource) {
    const sender = message.sender.trim().toLowerCase();
    const senderName = message.senderName?.trim().toLowerCase() ?? '';

    return (
        sender === 'tool' ||
        sender === 'toolresult' ||
        senderName === 'toolresult' ||
        Boolean(message.metadata?.toolCallId && message.metadata.toolName)
    );
}

function parseToolResult(content: string) {
    const trimmed = content.trim();

    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
        return trimmed.length > 0 ? { text: trimmed } : null;
    }

    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return { text: trimmed };
    }
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
