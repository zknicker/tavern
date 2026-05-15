import type { SessionLogPage, SessionMessage } from '../contracts.ts';

type SessionLogEntry = SessionLogPage['entries'][number];
type SortableSessionLogEntry = SessionLogEntry & { order: number };

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasToolCallPart(message: SessionMessage) {
    return (
        message.metadata?.parts?.some((part) => isRecord(part) && part.type === 'toolCall') ?? false
    );
}

function isToolResultMessage(message: SessionMessage) {
    const normalizedSender = message.sender.trim().toLowerCase();

    return (
        normalizedSender === 'toolresult' ||
        (message.senderType === 'system' &&
            (typeof message.metadata?.toolCallId === 'string' ||
                typeof message.metadata?.toolName === 'string'))
    );
}

function findMatchingToolResult({
    callId,
    consumedIndexes,
    currentIndex,
    messages,
    resultIndexesByCallId,
}: {
    callId: string;
    consumedIndexes: Set<number>;
    currentIndex: number;
    messages: SessionMessage[];
    resultIndexesByCallId: Map<string, number[]>;
}) {
    const indexes = resultIndexesByCallId.get(callId) ?? [];

    while (indexes.length > 0) {
        const resultIndex = indexes[0];

        if (resultIndex <= currentIndex || consumedIndexes.has(resultIndex)) {
            indexes.shift();
            continue;
        }

        const result = messages[resultIndex] ?? null;

        consumedIndexes.add(resultIndex);
        indexes.shift();
        return result;
    }

    return null;
}

export function buildMessageEntries(messages: SessionMessage[]) {
    const resultIndexesByCallId = new Map<string, number[]>();

    messages.forEach((message, index) => {
        if (!isToolResultMessage(message)) {
            return;
        }

        const callId = message.metadata?.toolCallId;

        if (!callId) {
            return;
        }

        const indexes = resultIndexesByCallId.get(callId) ?? [];
        indexes.push(index);
        resultIndexesByCallId.set(callId, indexes);
    });

    const consumedIndexes = new Set<number>();

    return messages.flatMap<SortableSessionLogEntry>((message, index) => {
        if (consumedIndexes.has(index)) {
            return [];
        }

        if (hasToolCallPart(message)) {
            const callId = message.metadata?.parts?.find(
                (part) => isRecord(part) && part.type === 'toolCall'
            );
            const result =
                typeof callId?.id === 'string'
                    ? findMatchingToolResult({
                          callId: callId.id,
                          consumedIndexes,
                          currentIndex: index,
                          messages,
                          resultIndexesByCallId,
                      })
                    : null;

            return [
                {
                    id: message.id,
                    invocation: message,
                    kind: 'toolExecution' as const,
                    order: index,
                    result,
                    timestamp: message.timestamp,
                },
            ];
        }

        if (isToolResultMessage(message)) {
            return [
                {
                    id: message.id,
                    invocation: null,
                    kind: 'toolExecution' as const,
                    order: index,
                    result: message,
                    timestamp: message.timestamp,
                },
            ];
        }

        return [
            {
                id: message.id,
                kind: 'message' as const,
                message,
                order: index,
                timestamp: message.timestamp,
            },
        ];
    });
}
