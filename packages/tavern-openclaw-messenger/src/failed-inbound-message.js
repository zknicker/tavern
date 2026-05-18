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
    updateSessionStore,
} from 'openclaw/plugin-sdk/session-store-runtime';
import { buildAcceptedTavernMetadata } from './message-identity.js';

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

export async function readTranscriptSession({ createSession = false, input, storePath }) {
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

    const existing = readStoreRecord(store[input.sessionKey]);
    const sessionId = readNonEmptyString(existing?.sessionId);

    if (!sessionId) {
        return null;
    }

    const { sessionFile } = await resolveAndPersistSessionFile({
        activeSessionKey: input.sessionKey,
        sessionEntry: existing,
        sessionId,
        sessionKey: input.sessionKey,
        sessionStore: store,
        sessionsDir: dirname(storePath),
        storePath,
    });

    return {
        runtimeStarted: hasRuntimeStarted(existing),
        sessionId,
        transcriptPath: sessionFile,
    };
}

export function readExistingTranscriptSessionFile({ input, storePath }) {
    let store;

    try {
        store = loadSessionStore(storePath);
    } catch {
        return null;
    }

    const existing = readStoreRecord(store[input.sessionKey]);
    const sessionId = readNonEmptyString(existing?.sessionId);
    const transcriptPath = readNonEmptyString(existing?.sessionFile);

    return sessionId && transcriptPath
        ? {
              runtimeStarted: hasRuntimeStarted(existing),
              sessionId,
              transcriptPath,
          }
        : null;
}

async function ensureSessionStoreEntry({ input, storePath }) {
    await updateSessionStore(
        storePath,
        (nextStore) => {
            const existing = readStoreRecord(nextStore[input.sessionKey]) ?? {};

            nextStore[input.sessionKey] = {
                ...existing,
                displayName: existing.displayName ?? input.text.slice(0, 120),
                sessionId: existing.sessionId ?? randomUUID(),
            };

            return nextStore[input.sessionKey];
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
    const metadata = buildAcceptedTavernMetadata(input);

    return {
        chatId: input.chatId,
        content: [{ text: input.text, type: 'text' }],
        id: input.messageId,
        messageId: input.messageId,
        metadata,
        nonce: input.nonce,
        role: 'user',
        sequence: input.sequence,
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

function readNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStoreRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasRuntimeStarted(entry) {
    return Boolean(
        entry &&
            (entry.systemSent === true ||
                Number.isFinite(entry.sessionStartedAt) ||
                Number.isFinite(entry.lastInteractionAt))
    );
}
