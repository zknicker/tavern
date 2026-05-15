import type {
    ChatLogOutput,
    SessionHistoryOutput,
    SessionHistoryToolCallOutput,
} from '../../lib/trpc.tsx';

type ThreadMessage =
    | Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'message' }>['message']
    | Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['message'];

interface MessageDisplayInput extends Pick<ThreadMessage, 'content' | 'metadata' | 'senderType'> {
    toolCall?: SessionHistoryToolCallOutput | null;
}

function looksLikeSerializedPayload(content: string) {
    const normalizedContent = content.trim();
    return normalizedContent.startsWith('{') || normalizedContent.startsWith('[');
}

export function getMessageDisplay(message: MessageDisplayInput) {
    const content = message.content.trim();
    const hasToolCall = Boolean(message.toolCall ?? message.metadata?.toolCallId);
    const showBodyContent =
        content.length > 0 && !(hasToolCall && looksLikeSerializedPayload(content));
    const showHeader =
        showBodyContent ||
        (hasToolCall && (content.length === 0 || !looksLikeSerializedPayload(content)));

    return {
        content,
        showBodyContent,
        showHeader,
    };
}
