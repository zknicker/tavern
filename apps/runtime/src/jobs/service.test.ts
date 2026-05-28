import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import { getCortexPage } from '../cortex/read';
import { ensureCortexSchema } from '../cortex/schema';
import { saveCortexSettings } from '../cortex/settings';
import { captureCortex } from '../cortex/write';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { type RuntimeJobsManager, startRuntimeJobsManager } from './manager';
import { ensureRuntimeJobsSchema } from './schema';
import { getRuntimeJob, listRuntimeJobs, runRuntimeJob } from './service';

describe('Runtime jobs service', () => {
    let jobs: RuntimeJobsManager | null = null;
    let jobsPath: string;
    let jobsRoot: string;
    let runtimeRoot: string;
    let vectorPath: string;
    let wikiPath: string;

    beforeAll(async () => {
        jobsRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-job-queue-'));
        jobsPath = path.join(jobsRoot, 'runtime.jobs.sqlite');
    });

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-jobs-'));
        wikiPath = path.join(runtimeRoot, 'wiki');
        vectorPath = path.join(runtimeRoot, 'vectors');
        process.env.TAVERN_CORTEX_VECTOR_PATH = vectorPath;
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureCortexSchema(db);
        ensureRuntimeJobsSchema(db);
    });

    afterEach(async () => {
        await jobs?.stop();
        jobs = null;
        vi.restoreAllMocks();
        closeDb();
        process.env.TAVERN_CORTEX_VECTOR_PATH = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    });

    afterAll(async () => {
        await rm(jobsRoot, { force: true, recursive: true });
    });

    test('exposes Cortex embedding generation as a Runtime job', async () => {
        mockEmbeddingModelVisibility();
        const store = createCortexHarness();
        store.saveSettings({
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });

        const { jobs: summaries } = await listRuntimeJobs();
        const embeddingsJob = summaries.find((job) => job.slug === 'cortex-generate-embeddings');

        expect(summaries.map((job) => job.slug)).toEqual([
            'refresh-runtime-capabilities',
            'cortex-generate-embeddings',
            'cortex-ingest',
            'cortex-lint',
            'cortex-maintenance',
        ]);
        expect(embeddingsJob).toMatchObject({
            availability: 'enabled',
            disabledReason: null,
            displayName: 'Generate Cortex Embeddings',
            schedule: {
                everyMs: 15 * 60 * 1000,
                kind: 'interval',
                runOnStart: true,
            },
            slug: 'cortex-generate-embeddings',
        });
    });

    test('disables Cortex embedding generation when embedding settings are incomplete', async () => {
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });
        const { jobs: summaries } = await listRuntimeJobs();
        const embeddingsJob = summaries.find((job) => job.slug === 'cortex-generate-embeddings');

        expect(embeddingsJob).toMatchObject({
            availability: 'disabled',
            disabledReason: 'Required capability missing: embedding model.',
            latestRun: null,
            schedule: {
                nextRunAt: null,
            },
            slug: 'cortex-generate-embeddings',
        });
        await expect(runRuntimeJob('cortex-generate-embeddings')).rejects.toThrow(
            'Required capability missing: embedding model.'
        );
    });

    test('disables Cortex embedding generation with a generic missing capability reason', async () => {
        const store = createCortexHarness();
        store.saveSettings({
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        insertFailedCortexEmbeddingRun(
            'OpenAI embedding request failed (429): You exceeded your current quota.'
        );
        mockEmbeddingModelVisibility();
        await refreshRuntimeCapabilities({ ids: ['embeddingModel'] });

        const job = await getRuntimeJob('cortex-generate-embeddings');

        expect(job).toMatchObject({
            availability: 'disabled',
            disabledReason: 'Required capability missing: embedding model.',
            slug: 'cortex-generate-embeddings',
        });
    });

    test('runs Cortex embedding generation through the Runtime jobs queue', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async (input) =>
                new Response(
                    JSON.stringify({
                        data: String(input).endsWith('/models')
                            ? [{ id: 'text-embedding-3-small' }]
                            : [{ embedding: Array.from({ length: 1536 }, () => 0.2) }],
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );
        const store = createCortexHarness();
        store.saveSettings({
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        store.capture({
            content: 'Runtime jobs should refresh Cortex embeddings.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Runtime Job Indexing',
            type: 'fact',
        });

        const queued = store.getPage('runtime-job-indexing');
        expect(queued?.indexing.status).toBe('needs-indexing');
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        const result = await runRuntimeJob('cortex-generate-embeddings');

        expect(result.jobId).toBeTruthy();
        await waitFor(() => store.getPage('runtime-job-indexing')?.indexing.status === 'ready');
        expect(store.getPage('runtime-job-indexing')?.indexing).toMatchObject({
            currentEmbeddingCount: 2,
            missingEmbeddingCount: 0,
            status: 'ready',
        });
        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-generate-embeddings');
            return job.latestRun?.state === 'completed';
        });
        await expect(getRuntimeJob('cortex-generate-embeddings')).resolves.toMatchObject({
            latestRun: {
                state: 'completed',
            },
            slug: 'cortex-generate-embeddings',
        });
    });

    test('records failed Cortex embedding generation runs', async () => {
        const store = createCortexHarness();
        store.saveSettings({
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        mockEmbeddingModelVisibility();
        await refreshRuntimeCapabilities({ ids: ['embeddingModel'] });
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });
        vi.restoreAllMocks();
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        error: {
                            code: 'insufficient_quota',
                            message: 'You exceeded your current quota.',
                            type: 'insufficient_quota',
                        },
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 429,
                    }
                )
        );
        store.capture({
            content: 'Runtime jobs should record failed embeddings.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Failed Runtime Job Indexing',
            type: 'fact',
        });

        const result = await runRuntimeJob('cortex-generate-embeddings');

        expect(result.jobId).toBeTruthy();
        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-generate-embeddings');
            return job.latestRun?.state === 'failed';
        });
        const failedJob = await getRuntimeJob('cortex-generate-embeddings');
        expect(failedJob.latestRun).toMatchObject({
            error: expect.stringContaining('insufficient_quota'),
            state: 'failed',
        });
        expect(failedJob.recentRuns[0]?.logs.join('\n')).toContain(
            'You exceeded your current quota.'
        );
        expect(failedJob.counts.failed).toBeGreaterThanOrEqual(1);
    });

    test('queues enabled startup jobs and records their run history', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            async (input) =>
                new Response(
                    JSON.stringify({
                        data: String(input).endsWith('/models')
                            ? [{ id: 'text-embedding-3-small' }]
                            : [{ embedding: Array.from({ length: 1536 }, () => 0.3) }],
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );
        const store = createCortexHarness();
        store.saveSettings({
            embedding: {
                apiKey: 'sk-test-cortex',
                model: 'text-embedding-3-small',
                provider: 'openai',
            },
        });
        store.capture({
            content: 'Startup jobs should refresh Cortex embeddings.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Startup Job Indexing',
            type: 'fact',
        });

        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        await waitFor(() => store.getPage('startup-job-indexing')?.indexing.status === 'ready');
        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-generate-embeddings');
            return job.latestRun?.state === 'completed';
        });
        await expect(getRuntimeJob('cortex-generate-embeddings')).resolves.toMatchObject({
            latestRun: {
                state: 'completed',
            },
            recentRuns: [
                {
                    state: 'completed',
                },
            ],
        });
    });
});

async function waitFor(
    predicate: () => boolean | Promise<boolean>,
    timeoutMs = 2000
): Promise<void> {
    const startedAt = Date.now();
    while (!(await predicate())) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for condition.');
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

function mockEmbeddingModelVisibility() {
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
}

function createCortexHarness() {
    return {
        capture: (input: Parameters<typeof captureCortex>[1]) => captureCortex(getDb(), input),
        getPage: (slugOrId: string) => getCortexPage(getDb(), slugOrId),
        saveSettings: (input: Parameters<typeof saveCortexSettings>[1]) =>
            saveCortexSettings(getDb(), input),
    };
}

function insertFailedCortexEmbeddingRun(error: string) {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_job_runs
             (id, job_slug, job_display_name, trigger, state, attempts_made, progress, error, logs_json, metadata_json, created_at, started_at, finished_at, updated_at)
             VALUES ('job-failed-cortex-index', 'cortex-generate-embeddings', 'Generate Cortex Embeddings', 'schedule', 'failed', 1, 0, $error, '[]', '{}', $now, $now, $now, $now)`
        )
        .run({ $error: error, $now: now });
}
