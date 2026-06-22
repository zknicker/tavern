import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { LocalHermesClient } from '../hermes/local-client';
import { createChat, listMessages } from './chat-api';
import { handleTavernRuntimeRequest } from './router';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';

describe('Hermes cron delivery into Tavern chats', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let runtimeRoot: string;
    let httpServer: ReturnType<typeof Bun.serve> | null = null;

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-cron-delivery-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        httpServer?.stop(true);
        httpServer = null;
        closeDb();
        if (originalRuntimeRoot === undefined) {
            process.env.TAVERN_RUNTIME_ROOT = undefined;
        } else {
            process.env.TAVERN_RUNTIME_ROOT = originalRuntimeRoot;
        }
        await fs.rm(runtimeRoot, { force: true, recursive: true });
    });

    it('creates a Hermes cron job and delivers a triggered run to a Tavern chat', async () => {
        createChat({ id: 'cht_cron', title: 'Cron target' });
        const job = {
            created_at: '2026-06-08T10:00:00.000Z',
            deliver: 'tavern:cht_cron',
            enabled: true,
            id: 'hermes_job_1',
            name: 'Scheduled check-in',
            next_run_at: '2026-06-08T10:01:00.000Z',
            prompt: 'post the check-in',
            schedule: { kind: 'interval', minutes: 1 },
            state: 'scheduled',
        };

        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'POST' && url.pathname === '/api/cron/jobs') {
                    return Response.json(job);
                }
                if (request.method === 'GET' && url.pathname === '/api/cron/jobs/hermes_job_1') {
                    return Response.json(job);
                }
                if (
                    request.method === 'POST' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/trigger'
                ) {
                    const deliveryResponse = await handleTavernRuntimeRequest(
                        new Request('http://runtime.local/cron/deliveries', {
                            body: JSON.stringify({
                                chatId: 'cht_cron',
                                content: 'Cron check-in delivered.',
                                cronJobId: 'hermes_job_1',
                                cronRunId: 'cron_hermes_job_1_1780000000',
                                sessionId: 'cron_hermes_job_1_1780000000',
                            }),
                            headers: { 'content-type': 'application/json' },
                            method: 'POST',
                        })
                    );
                    return Response.json({ delivered: deliveryResponse.ok });
                }
                if (
                    request.method === 'GET' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/runs'
                ) {
                    return Response.json({
                        runs: [
                            {
                                ended_at: 1_780_000_060,
                                id: 'cron_hermes_job_1_1780000000',
                                last_active: 1_780_000_060,
                                preview: 'Cron check-in delivered.',
                                started_at: 1_780_000_000,
                            },
                        ],
                    });
                }
                return new Response('not found', { status: 404 });
            },
            port: 0,
        });

        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${httpServer.port}`,
            token: null,
        });

        const created = await client.createCronJob({
            agentId: 'agt_hermes',
            delivery: { chatId: 'cht_cron' },
            id: 'cron_local_1',
            name: 'Scheduled check-in',
            payload: { kind: 'agentTurn', message: 'post the check-in' },
            schedule: { everyMs: 60_000, kind: 'every' },
            wakeMode: 'now',
        });
        const run = await client.runCronJob(created.id);
        const runs = await client.listCronRuns(created.id);
        const messages = listMessages('cht_cron');
        const runtimeEvents = listProjectedTavernRuntimeEvents();

        client.close();

        expect(created).toMatchObject({
            delivery: { chatId: 'cht_cron' },
            id: 'hermes_job_1',
            schedule: { everyMs: 60_000, kind: 'every' },
        });
        expect(run).toMatchObject({ deliveryStatus: 'pending', jobId: 'hermes_job_1' });
        expect(runs.runs[0]).toMatchObject({
            jobId: 'hermes_job_1',
            status: 'success',
            summary: 'Cron check-in delivered.',
        });
        expect(messages.messages).toHaveLength(1);
        expect(messages.messages[0]).toMatchObject({
            content: 'Cron check-in delivered.',
            metadata: {
                runtime: {
                    cronJobId: 'hermes_job_1',
                    cronRunId: 'cron_hermes_job_1_1780000000',
                    runId: 'run_cron_hermes_job_1_1780000000',
                    sessionKey: 'cron_hermes_job_1_1780000000',
                    source: 'hermes-cron',
                },
            },
            role: 'assistant',
        });
        expect(runtimeEvents.map((event) => event.event)).toEqual([
            expect.objectContaining({
                turn: expect.objectContaining({
                    chatId: 'cht_cron',
                    runId: 'run_cron_hermes_job_1_1780000000',
                    sessionKey: 'cron_hermes_job_1_1780000000',
                }),
                type: 'turn.completed',
            }),
        ]);
    });
});
