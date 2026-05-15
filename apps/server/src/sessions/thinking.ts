import type { SessionMessage, SessionThinking } from './contracts.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function buildSessionThinking(messages: SessionMessage[]) {
    const thinking: SessionThinking[] = [];

    for (const message of messages) {
        const parts = message.metadata?.parts;

        if (!Array.isArray(parts)) {
            continue;
        }

        for (const [index, part] of parts.entries()) {
            if (!isRecord(part) || part.type !== 'thinking') {
                continue;
            }

            let text = '';

            if (typeof part.text === 'string') {
                text = part.text.trim();
            } else if (typeof part.thinkingText === 'string') {
                text = part.thinkingText.trim();
            }

            if (text.length === 0) {
                continue;
            }

            thinking.push({
                id: `${message.id}:thinking:${index}`,
                messageId: message.id,
                sender: message.sender,
                text,
                timestamp: message.timestamp,
            });
        }
    }

    return thinking;
}
