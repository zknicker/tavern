import {
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionMessage,
    type AgentRuntimeSessionToolCall,
    agentRuntimeSessionGraphSchema,
} from '@tavern/agent-runtime-protocol';
import { asRecord, readString } from '../../gateway/records.ts';
import { mapOpenClawSessionMessages } from './messages.ts';
import { mapOpenClawSessionRecord } from './shared.ts';

export function mapOpenClawSessionGraph(input: {
    messages: unknown;
    session: unknown;
    sessionKey: string;
}): AgentRuntimeSessionGraph {
    const rawSession = asRecord(unwrapSessionRecord(input.session));
    const sessionMessages = Array.isArray(asRecord(input.session).messages)
        ? asRecord(input.session).messages
        : input.messages;
    const session = mapOpenClawSessionRecord({
        ...rawSession,
        key: readString(rawSession, ['key', 'sessionKey']) ?? input.sessionKey,
    });
    const messages = mapOpenClawSessionMessages({
        chatId: session.chatId,
        messages: sessionMessages,
        sessionKey: input.sessionKey,
    }).messages;

    return agentRuntimeSessionGraphSchema.parse({
        artifacts: [],
        links: [],
        messages,
        rootSessionKey: input.sessionKey,
        sessions: [session],
        toolCalls: buildToolCalls(messages),
    });
}

function unwrapSessionRecord(value: unknown) {
    if (Array.isArray(value)) {
        return value[0] ?? value;
    }

    const record = asRecord(value);
    const sessions = Array.isArray(record.sessions) ? record.sessions : null;

    return record.session ?? sessions?.[0] ?? record.record ?? record.data ?? value;
}

function buildToolCalls(messages: AgentRuntimeSessionMessage[]) {
    const records = new Map<string, AgentRuntimeSessionToolCall>();
    const pendingCallIds: string[] = [];

    for (const message of messages) {
        for (const part of getToolCallParts(message.metadata?.parts)) {
            const toolCallId = readString(part, ['id', 'toolCallId']);

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
                toolName: readString(part, ['name', 'toolName']) ?? 'unknown',
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
        const metadata = asRecord(message.metadata);
        const result = parseToolResult(message.content) ??
            metadata.toolResult ?? {
                text: message.content,
            };
        const resultRecord = asRecord(result);

        records.set(toolCallId, {
            arguments: existing?.arguments ?? null,
            childSessionKey: readString(resultRecord, ['childSessionKey', 'sessionKey']),
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
