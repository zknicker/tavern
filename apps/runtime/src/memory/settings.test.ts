import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { handleMemorySettingsRequest, isMemoryEnabled } from './settings.ts';

describe('Memory settings', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('defaults Memory on', async () => {
        expect(isMemoryEnabled()).toBe(true);

        const response = await handleMemorySettingsRequest(
            new Request('http://runtime.test/memory/settings')
        );

        await expect(response?.json()).resolves.toMatchObject({
            enabled: true,
            updatedAt: null,
        });
    });

    test('saves global Memory off', async () => {
        const response = await handleMemorySettingsRequest(
            new Request('http://runtime.test/memory/settings', {
                body: JSON.stringify({ enabled: false }),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );

        await expect(response?.json()).resolves.toMatchObject({
            enabled: false,
            restartScheduled: true,
        });
        expect(isMemoryEnabled()).toBe(false);
    });

    test('rejects non-Tavern Memory setting writes', async () => {
        const response = await handleMemorySettingsRequest(
            new Request('http://runtime.test/memory/settings', {
                body: JSON.stringify({ enabled: false }),
                headers: { 'content-type': 'application/json' },
                method: 'PUT',
            })
        );

        expect(response?.status).toBe(403);
        expect(isMemoryEnabled()).toBe(true);
    });
});
