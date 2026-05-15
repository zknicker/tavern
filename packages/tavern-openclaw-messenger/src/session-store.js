import { randomUUID } from 'node:crypto';
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import {
    resolveSessionStoreEntry,
    updateSessionStore,
} from 'openclaw/plugin-sdk/session-store-runtime';

export async function ensureSessionStoreEntry({ displayName, sessionKey, storePath }) {
    if (!(sessionKey && storePath)) {
        return { created: false, sessionKey, storePath };
    }

    let created = false;

    await updateSessionStore(
        storePath,
        (nextStore) => {
            const resolved = resolveSessionStoreEntry({
                sessionKey,
                store: nextStore,
            });
            const existing = resolved.existing ?? {};

            created = !existing.sessionId;
            nextStore[resolved.normalizedKey] = {
                ...existing,
                displayName: existing.displayName ?? displayName ?? resolved.normalizedKey,
                sessionId: existing.sessionId ?? randomUUID(),
            };

            for (const legacyKey of resolved.legacyKeys) {
                delete nextStore[legacyKey];
            }

            return nextStore[resolved.normalizedKey];
        },
        { activeSessionKey: sessionKey }
    );

    return { created, sessionKey, storePath };
}

export async function deleteSessionStoreEntry({ sessionKey, storePath }) {
    if (!(sessionKey && storePath)) {
        return { deleted: false, sessionKey, storePath };
    }

    let raw;
    let mode = 0o600;

    try {
        const file = await stat(storePath);
        mode = file.mode & 0o777;
        raw = await readFile(storePath, 'utf8');
    } catch (error) {
        if (error && typeof error === 'object' && error.code === 'ENOENT') {
            return { deleted: false, sessionKey, storePath };
        }
        throw error;
    }

    const sessions = parseSessionStore(raw, storePath);

    if (!Object.hasOwn(sessions, sessionKey)) {
        return { deleted: false, sessionKey, storePath };
    }

    delete sessions[sessionKey];

    const tempPath = `${storePath}.tavern-delete-${process.pid}-${Date.now()}.tmp`;

    try {
        await writeFile(tempPath, `${JSON.stringify(sessions, null, 2)}\n`, { mode });
        await rename(tempPath, storePath);
    } catch (error) {
        await unlink(tempPath).catch(() => {});
        throw error;
    }

    return { deleted: true, sessionKey, storePath };
}

function parseSessionStore(raw, storePath) {
    const parsed = JSON.parse(raw);

    if (!(parsed && typeof parsed === 'object' && !Array.isArray(parsed))) {
        throw new Error(`OpenClaw session store ${storePath} is not an object.`);
    }

    return parsed;
}
