import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { runtimeCapabilitiesRefreshJob } from '../jobs/definitions';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import { getRuntimeCapability, listRuntimeCapabilities, refreshRuntimeCapabilities } from './store';

describe('Runtime capabilities store', () => {
    let runtimeRoot: string;
    const originalPath = process.env.PATH;

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-capabilities-'));
        const binPath = path.join(runtimeRoot, 'bin');
        await mkdir(binPath, { recursive: true });
        await writeFile(path.join(binPath, 'codex'), '#!/bin/sh\necho codex-test\n', {
            mode: 0o755,
        });
        process.env.CODEX_HOME = path.join(runtimeRoot, 'empty-codex-home');
        process.env.PATH = binPath;
        process.env.TAVERN_VAULT_PATH = path.join(runtimeRoot, 'wiki');
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        closeDb();
        process.env.CODEX_HOME = undefined;
        process.env.PATH = originalPath;
        process.env.TAVERN_VAULT_PATH = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    });

    test('lists expected Runtime capabilities before the first refresh', () => {
        const capabilities = listRuntimeCapabilities();

        expect(capabilities.map((capability) => capability.id)).toEqual([
            'apiServer',
            'codexOAuth',
            'dashboardServer',
            'gateway',
            'models',
            'plugin.merchbase',
            'skills',
            'vault',
        ]);
        expect(getRuntimeCapability('vault')).toMatchObject({
            checkedAt: null,
            healthy: false,
            reason: 'Capability has not been checked yet.',
            state: 'unknown',
        });
    });

    test('scheduled Runtime capability refresh publishes update events for written rows', async () => {
        const events: string[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => {
            if (event.type === 'capability.updated') {
                events.push(event.capability);
            }
        });

        try {
            await runtimeCapabilitiesRefreshJob.run({
                input: {},
                log: async () => undefined,
                trigger: 'manual',
            });
        } finally {
            unsubscribe();
        }

        expect(events).toContain('gateway');
        expect(events).toContain('apiServer');
        expect(events).toContain('dashboardServer');
    });

    test('records a missing creatable Vault root as healthy', async () => {
        const [capability] = await refreshRuntimeCapabilities({ ids: ['vault'] });

        expect(capability).toMatchObject({
            healthy: true,
            id: 'vault',
            metadata: expect.objectContaining({
                configSource: 'environment',
                missing: true,
                vaultPath: path.join(runtimeRoot, 'wiki'),
            }),
            reason: null,
            state: 'healthy',
        });
    });

    test('keeps a readable read-only Vault root browseable', async () => {
        const hubPath = path.join(runtimeRoot, 'wiki');
        await mkdir(hubPath, { recursive: true });
        await chmod(hubPath, 0o555);

        try {
            const [capability] = await refreshRuntimeCapabilities({ ids: ['vault'] });

            expect(capability).toMatchObject({
                healthy: true,
                id: 'vault',
                metadata: expect.objectContaining({
                    writable: false,
                }),
                reason: null,
                state: 'healthy',
            });
        } finally {
            await chmod(hubPath, 0o755);
        }
    });
});
