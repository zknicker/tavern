import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
    appendSessionTranscriptMessage,
    emitSessionTranscriptUpdate,
} from 'openclaw/plugin-sdk/agent-harness-runtime';
import {
    loadSessionStore,
    resolveAndPersistSessionFile,
    resolveSessionStoreEntry,
    updateSessionStore,
} from 'openclaw/plugin-sdk/session-store-runtime';

export async function persistAcceptedInboundMessage({ createSession = false, input, storePath }) {
    const session = await readTranscriptSession({ createSession, input, storePath });

    if (!session) {
        return;
    }

    await appendInboundMessage({ input, ...session });
}

export async function persistFailedTurnMessages({ error, input, runId, storePath }) {
    const session = await readTranscriptSession({ input, storePath });

    if (!session) {
        return;
    }

    await appendInboundMessage({ input, ...session });

    if (await transcriptHasTurnFailure({ runId, transcriptPath: session.transcriptPath })) {
        return;
    }

    const timestamp = Math.max(resolveInputTimestampMs(input) + 1, Date.now());
    const message = {
        chatId: input.chatId,
        content: [{ text: `OpenClaw turn failed: ${formatErrorMessage(error)}`, type: 'text' }],
        messageId: `tavern-turn-failure:${runId}`,
        metadata: {
            tavern: {
                turnFailure: {
                    messageId: input.messageId,
                    runId,
                },
            },
            isError: true,
            stopReason: 'error',
        },
        role: 'system',
        sender: 'OpenClaw',
        senderId: 'openclaw',
        senderName: 'OpenClaw',
        sessionKey: input.sessionKey,
        timestamp,
    };

    await appendAndEmitMessage({
        input,
        message,
        sessionId: session.sessionId,
        timestamp,
        transcriptPath: session.transcriptPath,
    });
}

export async function transcriptHasFinalAssistantReply({ input, storePath }) {
    return Boolean(await readFinalAssistantReply({ input, storePath }));
}

export async function readFinalAssistantReply({ input, storePath }) {
    const session = await readTranscriptSession({ input, storePath });

    if (!session) {
        return null;
    }

    const raw = await readFile(session.transcriptPath, 'utf8').catch(() => null);

    if (!raw) {
        return null;
    }

    const inputTimestampMs = resolveInputTimestampMs(input);

    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }

        try {
            const message = JSON.parse(line)?.message;

            if (!(message && isAssistantReply(message))) {
                continue;
            }

            if (message.stopReason === 'error' || message.metadata?.isError === true) {
                continue;
            }

            const text = resolveMessageText(message).trim();

            if (!text) {
                continue;
            }

            const messageAtMs = resolveMessageTimestampMs(message.timestamp);

            if (
                !(Number.isFinite(inputTimestampMs) && Number.isFinite(messageAtMs)) ||
                messageAtMs >= inputTimestampMs
            ) {
                return text;
            }
        } catch {}
    }

    return null;
}

export async function persistDeliveredTurnMessage({ input, storePath, text }) {
    const session = await readTranscriptSession({ input, storePath });

    if (!session) {
        return;
    }

    await appendInboundMessage({ input, ...session });

    if (await transcriptHasDeliveredTurnMessage({ text, transcriptPath: session.transcriptPath })) {
        return;
    }

    const timestamp = Math.max(resolveInputTimestampMs(input) + 1, Date.now());
    const message = {
        content: [{ text, type: 'text' }],
        isError: true,
        role: 'assistant',
        sessionKey: input.sessionKey,
        stopReason: 'error',
        timestamp,
    };

    await appendAndEmitMessage({
        input,
        message,
        sessionId: session.sessionId,
        timestamp,
        transcriptPath: session.transcriptPath,
    });
}

async function readTranscriptSession({ createSession = false, input, storePath }) {
    let store;

    try {
        store = loadSessionStore(storePath);
    } catch {
        store = null;
    }

    if (!store) {
        return null;
    }

    if (createSession) {
        await ensureSessionStoreEntry({ input, storePath });
        store = loadSessionStore(storePath);
    }

    const resolved = resolveSessionStoreEntry({
        sessionKey: input.sessionKey,
        store,
    });
    const sessionId = readNonEmptyString(resolved.existing?.sessionId);

    if (!sessionId) {
        return null;
    }

    const { sessionFile } = await resolveAndPersistSessionFile({
        activeSessionKey: resolved.normalizedKey,
        sessionEntry: resolved.existing,
        sessionId,
        sessionKey: resolved.normalizedKey,
        sessionStore: store,
        sessionsDir: dirname(storePath),
        storePath,
    });

    return {
        sessionId,
        transcriptPath: sessionFile,
    };
}

async function ensureSessionStoreEntry({ input, storePath }) {
    await updateSessionStore(
        storePath,
        (nextStore) => {
            const resolved = resolveSessionStoreEntry({
                sessionKey: input.sessionKey,
                store: nextStore,
            });
            const existing = resolved.existing ?? {};

            nextStore[resolved.normalizedKey] = {
                ...existing,
                displayName: existing.displayName ?? input.text.slice(0, 120),
                sessionId: existing.sessionId ?? randomUUID(),
            };

            for (const legacyKey of resolved.legacyKeys) {
                delete nextStore[legacyKey];
            }

            return nextStore[resolved.normalizedKey];
        },
        { activeSessionKey: input.sessionKey }
    );
}

async function appendInboundMessage({ input, sessionId, transcriptPath }) {
    if (await transcriptHasInboundMessage({ input, transcriptPath })) {
        return;
    }

    const timestamp = resolveInputTimestampMs(input);
    const message = buildInboundMessage({ input, timestamp });

    await appendAndEmitMessage({ input, message, sessionId, timestamp, transcriptPath });
}

function buildInboundMessage({ input, timestamp }) {
    return {
        chatId: input.chatId,
        content: [{ text: input.text, type: 'text' }],
        messageId: input.messageId,
        metadata: input.metadata ?? undefined,
        role: 'user',
        sender: input.sender.name,
        senderId: input.sender.id,
        senderName: input.sender.name,
        sessionKey: input.sessionKey,
        timestamp,
    };
}

async function appendAndEmitMessage({ input, message, sessionId, timestamp, transcriptPath }) {
    const result = await appendSessionTranscriptMessage({
        message,
        now: timestamp,
        sessionId,
        transcriptPath,
    });

    emitSessionTranscriptUpdate({
        message,
        messageId: result.messageId,
        sessionFile: transcriptPath,
        sessionKey: input.sessionKey,
    });
}

function resolveInputTimestampMs(input) {
    const timestampMs = Date.parse(input.sentAt);

    return Number.isFinite(timestampMs) ? timestampMs : Date.now();
}

async function transcriptHasInboundMessage({ input, transcriptPath }) {
    const raw = await readFile(transcriptPath, 'utf8').catch(() => null);

    if (!raw) {
        return false;
    }

    const sentAtMs = Date.parse(input.sentAt);

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

            if (readNonEmptyString(message.messageId)) {
                continue;
            }

            const messageAtMs = resolveMessageTimestampMs(message.timestamp ?? record.timestamp);
            const isSamePrompt = resolveMessageText(message) === input.text;

            if (
                isSamePrompt &&
                Number.isFinite(sentAtMs) &&
                Number.isFinite(messageAtMs) &&
                Math.abs(messageAtMs - sentAtMs) < 60_000
            ) {
                return true;
            }
        } catch {}
    }

    return false;
}

async function transcriptHasTurnFailure({ runId, transcriptPath }) {
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

async function transcriptHasDeliveredTurnMessage({ text, transcriptPath }) {
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

function formatErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
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

function resolveMessageTimestampMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Date.parse(value);

        return Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    return Number.NaN;
}

function isAssistantReply(message) {
    return message.role === 'assistant' || message.role === 'agent';
}

function readNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
