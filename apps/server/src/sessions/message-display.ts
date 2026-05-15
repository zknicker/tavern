import type { SessionMessage } from './contracts.ts';

function looksLikeSerializedPayload(content: string) {
    const normalizedContent = content.trim();
    return normalizedContent.startsWith('{') || normalizedContent.startsWith('[');
}

export function getSessionMessageDisplay(message: SessionMessage) {
    const content = message.content.trim();
    const showBodyContent =
        content.length > 0 &&
        !(message.metadata?.toolCallId && looksLikeSerializedPayload(content));
    const showHeader =
        showBodyContent || !message.metadata?.toolCallId || message.senderType === 'agent';

    return {
        content,
        showBodyContent,
        showHeader,
    };
}
