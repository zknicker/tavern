import { normalizeTimestamp } from '../utils/time.ts';
import type { GlobalSession } from './contracts.ts';
import type { ChatHistoryMessage, LiveSession } from './message-shared.ts';
import {
    resolveMessageMetadata,
    resolveMessageSender,
    resolveMessageSenderType,
    resolveSessionMessageText,
} from './message-text.ts';

export function normalizeInlineSessionMessages(session: LiveSession): GlobalSession['messages'] {
    const fallbackTimestamp = normalizeTimestamp(session.updatedAt, new Date(0).toISOString());

    return (session.messages ?? [])
        .map((message, index): GlobalSession['messages'][number] | null => {
            const content = resolveSessionMessageText(
                message.content ?? message.parts ?? message.text
            );

            if (content.length === 0) {
                const metadata = resolveMessageMetadata({
                    content: message.content ?? message.parts,
                });

                if (!metadata) {
                    return null;
                }

                const role = message.role?.trim().toLowerCase();

                return {
                    content,
                    id: message.id ?? `${session.sessionId ?? session.key}-message-${index}`,
                    metadata,
                    sender: resolveMessageSender(message, role),
                    senderType: resolveMessageSenderType(role),
                    timestamp: normalizeTimestamp(
                        typeof message.createdAt === 'string' ||
                            typeof message.createdAt === 'number'
                            ? message.createdAt
                            : message.timestamp,
                        fallbackTimestamp
                    ),
                };
            }

            const role = message.role?.trim().toLowerCase();

            return {
                content,
                id: message.id ?? `${session.sessionId ?? session.key}-message-${index}`,
                metadata: resolveMessageMetadata({
                    content: message.content ?? message.parts,
                }),
                sender: resolveMessageSender(message, role),
                senderType: resolveMessageSenderType(role),
                timestamp: normalizeTimestamp(
                    typeof message.createdAt === 'string' || typeof message.createdAt === 'number'
                        ? message.createdAt
                        : message.timestamp,
                    fallbackTimestamp
                ),
            };
        })
        .filter((message): message is GlobalSession['messages'][number] => message !== null);
}

export function normalizeChatHistoryMessages(
    session: LiveSession,
    messages: ChatHistoryMessage[]
): GlobalSession['messages'] {
    const fallbackTimestamp = normalizeTimestamp(session.updatedAt, new Date(0).toISOString());

    return messages
        .map((message, index): GlobalSession['messages'][number] | null => {
            const content = resolveSessionMessageText(message.text ?? message.content);
            const role = message.role?.trim().toLowerCase();
            const metadata = resolveMessageMetadata({
                api: message.api ?? undefined,
                content: message.content,
                isError: typeof message.isError === 'boolean' ? message.isError : undefined,
                model: message.model ?? undefined,
                provider: message.provider ?? undefined,
                stopReason: message.stopReason ?? undefined,
                toolCallId: typeof message.toolCallId === 'string' ? message.toolCallId : undefined,
                toolName: typeof message.toolName === 'string' ? message.toolName : undefined,
                usage: message.usage,
            });

            if (content.length === 0 && !metadata) {
                return null;
            }

            return {
                content,
                id: message._meta?.id ?? `${session.sessionId ?? session.key}-history-${index}`,
                metadata,
                sender: role ?? 'system',
                senderType: resolveMessageSenderType(role),
                timestamp: normalizeTimestamp(message.timestamp, fallbackTimestamp),
            };
        })
        .filter((message): message is GlobalSession['messages'][number] => message !== null);
}

export function createSessionSummaryMessages(session: LiveSession): GlobalSession['messages'] {
    const timestamp = normalizeTimestamp(session.updatedAt, new Date(0).toISOString());

    return [
        {
            content: session.derivedTitle ?? `Session key ${session.key}`,
            id: `${session.sessionId ?? session.key}-prompt`,
            sender: 'system',
            senderType: 'system' as const,
            timestamp,
        },
        {
            content:
                session.lastMessagePreview ??
                (session.model
                    ? `Current model: ${session.model}`
                    : 'Runtime session discovered live.'),
            id: `${session.sessionId ?? session.key}-result`,
            sender: 'assistant',
            senderType: 'agent' as const,
            timestamp,
        },
    ].filter((message) => message.content.trim().length > 0);
}
