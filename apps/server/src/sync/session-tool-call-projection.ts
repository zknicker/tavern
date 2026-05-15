import type {
    AgentRuntimeSessionMessage,
    AgentRuntimeSessionToolCall,
} from '@tavern/agent-runtime-protocol';

export function buildSessionToolCallsFromMessages(
    messages: AgentRuntimeSessionMessage[]
): AgentRuntimeSessionToolCall[] {
    const records = new Map<string, AgentRuntimeSessionToolCall>();
    const pendingCallIds: string[] = [];

    for (const message of messages) {
        for (const part of getToolCallParts(message.metadata?.parts)) {
            const toolCallId = readRecordString(part, 'id') ?? readRecordString(part, 'toolCallId');

            if (!toolCallId) {
                continue;
            }

            records.set(toolCallId, {
                arguments: part.arguments ?? null,
                childSessionKey: null,
                finishedAt: null,
                id: `${message.id}:tool:${toolCallId}`,
                isError: null,
                messageId: message.id,
                result: null,
                sessionKey: message.sessionKey,
                startedAt: message.timestamp,
                toolCallId,
                toolName:
                    readRecordString(part, 'name') ??
                    readRecordString(part, 'toolName') ??
                    'unknown',
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
        const result = parseToolResult(message.content) ??
            message.metadata?.toolResult ?? {
                text: message.content,
            };
        const resultRecord = asRecord(result);

        records.set(toolCallId, {
            arguments: existing?.arguments ?? null,
            childSessionKey:
                readRecordString(resultRecord, 'childSessionKey') ??
                readRecordString(resultRecord, 'sessionKey'),
            finishedAt: message.timestamp,
            id: existing?.id ?? `${message.id}:tool:${toolCallId}`,
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

function getToolCallParts(parts: unknown) {
    return Array.isArray(parts)
        ? parts.filter((part): part is Record<string, unknown> => {
              return asRecord(part).type === 'toolCall';
          })
        : [];
}

function isToolResultMessage(message: AgentRuntimeSessionMessage) {
    const sender = message.sender.trim().toLowerCase();
    const senderName = message.senderName.trim().toLowerCase();

    return sender === 'tool' || sender === 'toolresult' || senderName === 'toolresult';
}

function parseToolResult(content: string) {
    const trimmed = content.trim();

    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
        return null;
    }

    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return null;
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readRecordString(record: Record<string, unknown>, key: string) {
    const value = record[key];

    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
