import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ACTIVE_TURNS_KEY = Symbol.for('tavern.openclaw.activeTurnsBySessionKey');
const ACTIVE_TURNS_DIR = join(tmpdir(), 'tavern-openclaw-message-identity');
const activeTurnsBySessionKey = globalThis[ACTIVE_TURNS_KEY] ?? new Map();

globalThis[ACTIVE_TURNS_KEY] = activeTurnsBySessionKey;

export function buildAcceptedTavernMetadata(input) {
    const existingTavern =
        input.metadata?.tavern &&
        typeof input.metadata.tavern === 'object' &&
        !Array.isArray(input.metadata.tavern)
            ? input.metadata.tavern
            : {};

    return {
        ...(input.metadata ?? {}),
        tavern: {
            ...existingTavern,
            acceptedMessageId: input.messageId,
            acceptedRunId: input.turnId ?? buildRunId(input.messageId),
            chatId: input.chatId,
            nonce: input.nonce,
            sequence: input.sequence,
            sessionKey: input.sessionKey,
        },
    };
}

export function registerActiveTavernTurn(input) {
    const key = normalizeSessionKey(input.sessionKey);
    const current = activeTurnsBySessionKey.get(key) ?? [];
    const record = {
        agentId: input.agentId,
        chatId: input.chatId,
        messageId: input.messageId,
        metadata: buildAcceptedTavernMetadata(input),
        nonce: input.nonce,
        sequence: input.sequence,
        sender: input.sender,
        sessionKey: input.sessionKey,
        text: input.text,
        timestamp: input.sentAt,
        turnId: input.turnId ?? buildRunId(input.messageId),
    };

    activeTurnsBySessionKey.set(key, [...current, record]);
    writeActiveTurnRecord(record);

    return () => {
        const next = (activeTurnsBySessionKey.get(key) ?? []).filter((item) => item !== record);

        if (next.length === 0) {
            activeTurnsBySessionKey.delete(key);
            removeActiveTurnRecord(record);
            return;
        }

        activeTurnsBySessionKey.set(key, next);
        removeActiveTurnRecord(record);
    };
}

function buildRunId(messageId) {
    return `run_${stripPrefix(String(messageId), 'msg_')}`;
}

function stripPrefix(value, prefix) {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export function applyActiveTavernMessageIdentity(event, context = {}) {
    const message = event?.message;

    if (!message || typeof message !== 'object' || message.role !== 'user') {
        return;
    }

    const active = readActiveTurn(
        context.sessionKey ?? event.context?.sessionKey ?? event.sessionKey
    );

    if (!active) {
        return;
    }

    if (
        message.metadata?.tavern?.acceptedMessageId === active.messageId &&
        message.messageId === active.messageId &&
        message.id === active.messageId
    ) {
        return;
    }

    return {
        message: {
            ...message,
            id: active.messageId,
            messageId: active.messageId,
            metadata: mergeMetadata(message.metadata, active.metadata),
            nonce: active.nonce,
            sequence: active.sequence,
            sender: active.sender.name,
            senderId: active.sender.id,
            senderName: active.sender.name,
            sessionKey: active.sessionKey,
        },
    };
}

export function registerTavernMessageIdentityHook(api) {
    if (typeof api?.on !== 'function') {
        throw new Error('Tavern Messenger requires OpenClaw typed plugin hooks.');
    }

    return api.on('before_message_write', applyActiveTavernMessageIdentity, {
        priority: 100,
    });
}

function readActiveTurn(sessionKey) {
    const stack = activeTurnsBySessionKey.get(normalizeSessionKey(sessionKey));

    if (stack?.length) {
        return stack.at(-1);
    }

    const persisted = readPersistedActiveTurn(sessionKey);

    if (persisted) {
        return persisted;
    }

    const activeTurns = [...activeTurnsBySessionKey.values()].flat();

    if (activeTurns.length !== 1) {
        return null;
    }

    return activeTurns[0] ?? null;
}

function writeActiveTurnRecord(record) {
    try {
        mkdirSync(ACTIVE_TURNS_DIR, { recursive: true });
        writeFileSync(activeTurnPath(record), JSON.stringify(record), 'utf8');
    } catch {}
}

function removeActiveTurnRecord(record) {
    try {
        rmSync(activeTurnPath(record), { force: true });
    } catch {}
}

function readPersistedActiveTurn(sessionKey) {
    const sessionPath = activeTurnPath({ sessionKey });
    const sessionRecord = readActiveTurnFile(sessionPath);

    if (sessionRecord) {
        return sessionRecord;
    }

    let records = [];

    try {
        if (!existsSync(ACTIVE_TURNS_DIR)) {
            return null;
        }

        records = readdirSync(ACTIVE_TURNS_DIR)
            .filter((name) => name.endsWith('.json'))
            .flatMap((name) => {
                const record = readActiveTurnFile(join(ACTIVE_TURNS_DIR, name));
                return record ? [record] : [];
            });
    } catch {
        return null;
    }

    if (records.length !== 1) {
        return null;
    }

    return records[0] ?? null;
}

function readActiveTurnFile(path) {
    try {
        const record = JSON.parse(readFileSync(path, 'utf8'));

        return record && typeof record === 'object' ? record : null;
    } catch {
        return null;
    }
}

function activeTurnPath(record) {
    return join(ACTIVE_TURNS_DIR, `${hashActiveTurnKey(record.sessionKey)}.json`);
}

function hashActiveTurnKey(sessionKey) {
    return createHash('sha256').update(normalizeSessionKey(sessionKey)).digest('hex');
}

function mergeMetadata(base, accepted) {
    const baseRecord = base && typeof base === 'object' && !Array.isArray(base) ? base : {};

    return {
        ...baseRecord,
        ...accepted,
        tavern: {
            ...(baseRecord.tavern &&
            typeof baseRecord.tavern === 'object' &&
            !Array.isArray(baseRecord.tavern)
                ? baseRecord.tavern
                : {}),
            ...accepted.tavern,
        },
    };
}

function normalizeSessionKey(sessionKey) {
    return typeof sessionKey === 'string' ? sessionKey.trim().toLowerCase() : '';
}
