import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { runtimeCapabilitiesRefreshJob } from '../jobs/definitions';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import { handleMemorySettingsRequest } from '../memory/settings';
import { upsertStoredAgent } from '../tavern/agents-store';
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
        process.env.TAVERN_WIKI_PATH = path.join(runtimeRoot, 'memory');
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        closeDb();
        process.env.CODEX_HOME = undefined;
        process.env.PATH = originalPath;
        process.env.TAVERN_WIKI_PATH = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    });

    test('lists expected Runtime capabilities before the first refresh', () => {
        const capabilities = listRuntimeCapabilities();

        expect(capabilities.map((capability) => capability.id)).toEqual([
            'apiServer',
            'codexOAuth',
            'cron',
            'dashboardServer',
            'devToolkit',
            'gateway',
            'memory',
            'memoryDreaming',
            'memoryExtraction',
            'modelExecution',
            'plugin.google.calendar',
            'plugin.merchbase',
            'skills',
            'wiki',
            'wikiRecall',
        ]);
        expect(getRuntimeCapability('wiki')).toMatchObject({
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

    test('records a missing creatable Wiki root as healthy', async () => {
        const [capability] = await refreshRuntimeCapabilities({ ids: ['wiki'] });

        expect(capability).toMatchObject({
            healthy: true,
            id: 'wiki',
            metadata: expect.objectContaining({
                configSource: 'environment',
                missing: true,
                wikiPath: path.join(runtimeRoot, 'memory'),
            }),
            reason: null,
            state: 'healthy',
        });
    });

    test('keeps a readable read-only Wiki root browseable', async () => {
        const hubPath = path.join(runtimeRoot, 'memory');
        await mkdir(hubPath, { recursive: true });
        await chmod(hubPath, 0o555);

        try {
            const [capability] = await refreshRuntimeCapabilities({ ids: ['wiki'] });

            expect(capability).toMatchObject({
                healthy: true,
                id: 'wiki',
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

    test('reports core Memory healthy when agent workspaces can hold memory files', async () => {
        const workspaceFolder = path.join(runtimeRoot, 'agents', 'primary', 'workspace');
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Primary',
                primaryColor: null,
                workspaceFolder,
            },
        });

        const [capability] = await refreshRuntimeCapabilities({ ids: ['memory'] });

        expect(capability).toMatchObject({
            healthy: true,
            id: 'memory',
            metadata: expect.objectContaining({
                agentCount: 1,
                enabled: true,
            }),
            reason: null,
            state: 'healthy',
        });
    });

    test('reports core Memory unavailable when Memory is off', async () => {
        await handleMemorySettingsRequest(
            new Request('http://runtime.test/memory/settings', {
                body: JSON.stringify({ enabled: false }),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );

        const [memory] = await refreshRuntimeCapabilities({ ids: ['memory'] });
        const [extraction] = await refreshRuntimeCapabilities({ ids: ['memoryExtraction'] });
        const [dreaming] = await refreshRuntimeCapabilities({ ids: ['memoryDreaming'] });

        expect(memory).toMatchObject({
            healthy: false,
            id: 'memory',
            reason: 'Memory is off.',
            state: 'unavailable',
        });
        expect(extraction).toMatchObject({
            healthy: false,
            id: 'memoryExtraction',
            reason: 'Memory is off.',
            state: 'unavailable',
        });
        expect(dreaming).toMatchObject({
            healthy: false,
            id: 'memoryDreaming',
            reason: 'Memory is off.',
            state: 'unavailable',
        });
    });
});
