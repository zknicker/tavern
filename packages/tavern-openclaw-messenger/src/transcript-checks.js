import { readFile } from 'node:fs/promises';

export async function transcriptHasInboundMessage({ input, transcriptPath }) {
    const raw = await readFile(transcriptPath, 'utf8').catch(() => null);

    if (!raw) {
        return false;
    }

    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }

        try {
            const record = JSON.parse(line);
            const message = record?.message;

            if (!message || message.role !== 'user') {
                continue;
            }

            if (message.messageId === input.messageId) {
                return true;
            }

            if (message.metadata?.tavern?.acceptedMessageId === input.messageId) {
                return true;
            }
        } catch {}
    }

    return false;
}

export async function transcriptHasTurnFailure({ runId, transcriptPath }) {
    const raw = await readFile(transcriptPath, 'utf8').catch(() => null);

    if (!raw) {
        return false;
    }

    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }

        try {
            const message = JSON.parse(line)?.message;

            if (message?.metadata?.tavern?.turnFailure?.runId === runId) {
                return true;
            }
        } catch {}
    }

    return false;
}

export async function transcriptHasDeliveredTurnMessage({ text, transcriptPath }) {
    const raw = await readFile(transcriptPath, 'utf8').catch(() => null);

    if (!raw) {
        return false;
    }

    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }

        try {
            const message = JSON.parse(line)?.message;

            if (
                message?.role === 'assistant' &&
                message?.stopReason === 'error' &&
                resolveMessageText(message) === text
            ) {
                return true;
            }
        } catch {}
    }

    return false;
}

function resolveMessageText(message) {
    if (typeof message.content === 'string') {
        return message.content;
    }

    if (!Array.isArray(message.content)) {
        return '';
    }

    return message.content
        .map((part) =>
            part && typeof part === 'object' && typeof part.text === 'string' ? part.text : ''
        )
        .join('');
}
