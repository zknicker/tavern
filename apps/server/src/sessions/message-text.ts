import { normalizeModelIdentity } from '../model/identity.ts';
import type { GlobalSession } from './contracts.ts';
import type { LiveSessionMessage } from './message-shared.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resolveSessionMessageText(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value
            .map((part) => resolveSessionMessageText(part))
            .filter((part) => part.length > 0)
            .join('\n')
            .trim();
    }

    if (!isRecord(value)) {
        return '';
    }

    if (typeof value.text === 'string') {
        return value.text.trim();
    }

    for (const key of ['content', 'parts', 'blocks']) {
        if (!(key in value)) {
            continue;
        }

        const resolved = resolveSessionMessageText(value[key]);
        if (resolved.length > 0) {
            return resolved;
        }
    }

    if (typeof value.value === 'string') {
        return value.value.trim();
    }

    return '';
}

function resolveMessageParts(value: unknown) {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const parts = value.filter(isRecord);

    return parts.length > 0 ? parts : undefined;
}

export function resolveMessageMetadata(input: {
    api?: string;
    content?: unknown;
    isError?: boolean;
    model?: string;
    provider?: string;
    stopReason?: string;
    toolCallId?: string;
    toolName?: string;
    usage?: unknown;
}): GlobalSession['messages'][number]['metadata'] {
    const modelInfo = normalizeModelIdentity({
        model: input.model,
        provider: input.provider,
    });
    const metadata: NonNullable<GlobalSession['messages'][number]['metadata']> = {
        api: input.api,
        isError: input.isError,
        model: modelInfo?.model,
        modelInfo,
        parts: resolveMessageParts(input.content),
        provider: modelInfo?.provider,
        stopReason: input.stopReason,
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        usage: input.usage,
    };

    return Object.values(metadata).some((value) => typeof value !== 'undefined')
        ? metadata
        : undefined;
}

export function resolveMessageSender(message: LiveSessionMessage, role: string | undefined) {
    for (const candidate of [message.sender, message.author, message.label, role]) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate;
        }
    }

    return 'system';
}

export function resolveMessageSenderType(
    role: string | undefined
): GlobalSession['messages'][number]['senderType'] {
    if (role === 'assistant') {
        return 'agent';
    }

    if (role === 'user') {
        return 'user';
    }

    return 'system';
}
