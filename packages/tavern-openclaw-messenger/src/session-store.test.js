import { describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteSessionStoreEntry, ensureSessionStoreEntry } from './session-store.js';

describe('Tavern Messenger session store cleanup', () => {
    it('creates an OpenClaw session record before the first send', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'tavern-session-store-'));
        const storePath = join(directory, 'sessions.json');

        const result = await ensureSessionStoreEntry({
            displayName: 'Planning',
            sessionKey: 'agent:main:tavern:channel:chat-1',
            storePath,
        });
        const store = JSON.parse(await readFile(storePath, 'utf8'));

        expect(result).toMatchObject({
            created: true,
            sessionKey: 'agent:main:tavern:channel:chat-1',
            storePath,
        });
        expect(store['agent:main:tavern:channel:chat-1']).toMatchObject({
            displayName: 'Planning',
        });
        expect(store['agent:main:tavern:channel:chat-1'].sessionId).toBeString();
    });

    it('deletes one OpenClaw session record by session key', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'tavern-session-store-'));
        const storePath = join(directory, 'sessions.json');
        await writeFile(
            storePath,
            `${JSON.stringify(
                {
                    'agent:main:tavern:channel:chat-1': { id: 'remove' },
                    'agent:main:tavern:channel:chat-2': { id: 'keep' },
                },
                null,
                2
            )}\n`
        );

        const result = await deleteSessionStoreEntry({
            sessionKey: 'agent:main:tavern:channel:chat-1',
            storePath,
        });

        expect(result).toMatchObject({
            deleted: true,
            sessionKey: 'agent:main:tavern:channel:chat-1',
            storePath,
        });
        expect(JSON.parse(await readFile(storePath, 'utf8'))).toEqual({
            'agent:main:tavern:channel:chat-2': { id: 'keep' },
        });
    });

    it('treats missing session stores as already clean', async () => {
        const result = await deleteSessionStoreEntry({
            sessionKey: 'agent:main:tavern:channel:missing',
            storePath: join(tmpdir(), 'missing-tavern-session-store.json'),
        });

        expect(result).toMatchObject({
            deleted: false,
            sessionKey: 'agent:main:tavern:channel:missing',
        });
    });
});
