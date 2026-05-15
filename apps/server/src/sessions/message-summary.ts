import type { GlobalSession } from './contracts.ts';

const sessionSummaryMessageLimit = 280;

function summarizeSessionMessageContent(content: string) {
    const normalized = content.replace(/\s+/g, ' ').trim();

    if (normalized.length <= sessionSummaryMessageLimit) {
        return normalized;
    }

    return `${normalized.slice(0, sessionSummaryMessageLimit - 1).trimEnd()}…`;
}

function summarizeSessionMessageMetadata(metadata: GlobalSession['messages'][number]['metadata']) {
    if (!metadata) {
        return undefined;
    }

    const toolParts = metadata.parts?.filter(
        (part) => Boolean(part) && typeof part === 'object' && part.type === 'toolCall'
    );
    const summarizedMetadata = {
        isError: metadata.isError,
        model: metadata.model,
        modelInfo: metadata.modelInfo,
        parts: toolParts && toolParts.length > 0 ? toolParts : undefined,
        provider: metadata.provider,
        toolCallId: metadata.toolCallId,
        toolName: metadata.toolName,
    };

    return Object.values(summarizedMetadata).some((value) => typeof value !== 'undefined')
        ? summarizedMetadata
        : undefined;
}

export function summarizeSessionMessagesPage(page: {
    limit: number;
    messages: GlobalSession['messages'];
    offset: number;
    total: number;
}) {
    return {
        ...page,
        messages: page.messages.map((message) => ({
            ...message,
            content: summarizeSessionMessageContent(message.content),
            metadata: summarizeSessionMessageMetadata(message.metadata),
        })),
    };
}
