import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { agentRuntimeRoutes } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getRuntimeCapability } from '../capabilities/store';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureRuntimeJobsSchema } from '../jobs/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from './db';
import { handleCortexRequest } from './routes';

describe('Cortex routes', () => {
    let runtimeRoot: string;
    const originalPath = process.env.PATH;

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-cortex-routes-'));
        const binPath = path.join(runtimeRoot, 'bin');
        await mkdir(binPath, { recursive: true });
        await writeFile(path.join(binPath, 'codex'), '#!/bin/sh\necho codex-test\n', {
            mode: 0o755,
        });
        process.env.CODEX_HOME = path.join(runtimeRoot, 'codex-home');
        process.env.PATH = binPath;
        process.env.TAVERN_CORTEX_WIKI_PATH = path.join(runtimeRoot, 'cortex-wiki');

        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        closeDb();
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.PATH = originalPath;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    });

    test('refreshes embedding model capability when Cortex settings are saved', async () => {
        const events: unknown[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => events.push(event));
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        data: [{ id: 'text-embedding-3-small' }],
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );

        try {
            const response = await handleCortexRequest(
                new Request(`http://runtime.test${agentRuntimeRoutes.cortexSettings}`, {
                    body: JSON.stringify({
                        embedding: {
                            apiKey: 'sk-test-cortex-api-key-value',
                            model: 'text-embedding-3-small',
                            provider: 'openai',
                        },
                    }),
                    headers: { 'content-type': 'application/json' },
                    method: 'PUT',
                })
            );

            expect(response?.status).toBe(200);
            expect(getRuntimeCapability('embeddingModel')).toMatchObject({
                healthy: true,
                state: 'healthy',
            });
            expect(events).toContainEqual(
                expect.objectContaining({
                    capability: 'embeddingModel',
                    type: 'capability.updated',
                })
            );
        } finally {
            unsubscribe();
        }
    });
});
