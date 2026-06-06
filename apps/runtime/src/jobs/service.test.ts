import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import { ensureCortexRuntimeBootstrap } from '../cortex/bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from '../cortex/db';
import { listCortexDreamReports } from '../cortex/dream-report';
import { writeCanonicalCortexMarkdownDraft } from '../cortex/markdown-file';
import { getCortexPage } from '../cortex/read';
import { saveCortexSettings } from '../cortex/settings';
import { captureCortex } from '../cortex/write';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { namedParams } from '../db/sqlite';
import { handleTavernRuntimeRequest } from '../tavern/router';
import {
    type RuntimeJobsManager,
    reconcileRuntimeJobSchedules,
    startRuntimeJobsManager,
} from './manager';
import { ensureRuntimeJobsSchema } from './schema';
import { getRuntimeJob, listRuntimeJobs, runRuntimeJob } from './service';

describe('Runtime jobs service', () => {
    let jobs: RuntimeJobsManager | null = null;
    let jobsPath: string;
    let jobsRoot: string;
    let runtimeRoot: string;
    let wikiPath: string;

    beforeAll(async () => {
        jobsRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-job-queue-'));
        jobsPath = path.join(jobsRoot, 'runtime.jobs.sqlite');
    });

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-runtime-jobs-'));
        wikiPath = path.join(runtimeRoot, 'wiki');
        process.env.OPENAI_API_KEY = '';
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        process.env.CODEX_HOME = path.join(runtimeRoot, 'empty-codex-home');
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    }, 20_000);

    afterEach(async () => {
        await jobs?.stop();
        jobs = null;
        vi.restoreAllMocks();
        closeDb();
        await closeCortexDb();
        process.env.OPENAI_API_KEY = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        process.env.CODEX_HOME = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    }, 20_000);

    afterAll(async () => {
        await rm(jobsRoot, { force: true, recursive: true });
    });

    test('exposes Cortex embedding generation as a Runtime job', async () => {
        mockEmbeddingModelVisibility();
        await saveTestOpenAiKey();

        const { jobs: summaries } = await listRuntimeJobs();
        const embeddingsJob = summaries.find((job) => job.slug === 'cortex-generate-embeddings');

        expect(summaries.map((job) => job.slug)).toEqual([
            'refresh-runtime-capabilities',
            'tavern-highlights',
            'cortex-generate-embeddings',
            'cortex-sync',
            'cortex-lint',
            'cortex-repair-derived-state',
            'cortex-chat-ingestion',
            'cortex-dream',
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
        expect(summaries.find((job) => job.slug === 'cortex-sync')).toMatchObject({
            schedule: {
                everyMs: 24 * 60 * 60 * 1000,
                runOnStart: true,
            },
            slug: 'cortex-sync',
        });
        expect(summaries.find((job) => job.slug === 'cortex-lint')).toMatchObject({
            schedule: {
                everyMs: 24 * 60 * 60 * 1000,
                runOnStart: false,
            },
            slug: 'cortex-lint',
        });
        expect(summaries.find((job) => job.slug === 'cortex-repair-derived-state')).toMatchObject({
            schedule: {
                everyMs: 24 * 60 * 60 * 1000,
                runOnStart: false,
            },
            slug: 'cortex-repair-derived-state',
        });
        expect(summaries.find((job) => job.slug === 'cortex-dream')).toMatchObject({
            schedule: {
                everyMs: 24 * 60 * 60 * 1000,
                runOnStart: false,
            },
            slug: 'cortex-dream',
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

    test('disables Cortex Dream when Codex OAuth credentials are missing', async () => {
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        const dreamJob = await getRuntimeJob('cortex-dream');

        expect(dreamJob).toMatchObject({
            availability: 'disabled',
            disabledReason: 'Required capability missing: Codex OAuth.',
            latestRun: null,
            schedule: {
                nextRunAt: null,
            },
            slug: 'cortex-dream',
        });
        await expect(runRuntimeJob('cortex-dream')).rejects.toThrow(
            'Required capability missing: Codex OAuth.'
        );
    });

    test('disables Cortex Chat Ingestion when Codex OAuth credentials are missing', async () => {
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        const chatIngestionJob = await getRuntimeJob('cortex-chat-ingestion');

        expect(chatIngestionJob).toMatchObject({
            availability: 'disabled',
            disabledReason: 'Required capability missing: Codex OAuth.',
            latestRun: null,
            schedule: {
                everyMs: 5 * 60 * 1000,
                nextRunAt: null,
            },
            slug: 'cortex-chat-ingestion',
        });
        await expect(runRuntimeJob('cortex-chat-ingestion')).rejects.toThrow(
            'Required capability missing: Codex OAuth.'
        );
    });

    test('enables Cortex Dream when Codex OAuth credentials are available', async () => {
        const codexHome = path.join(runtimeRoot, 'codex-home');
        await mkdir(codexHome, { recursive: true });
        await writeFile(
            path.join(codexHome, 'auth.json'),
            JSON.stringify({
                tokens: {
                    access_token: 'codex-access-token',
                    account_id: 'account-1',
                },
            })
        );
        process.env.CODEX_HOME = codexHome;

        const dreamJob = await getRuntimeJob('cortex-dream');

        expect(dreamJob).toMatchObject({
            availability: 'enabled',
            disabledReason: null,
            slug: 'cortex-dream',
        });
        await expect(getRuntimeJob('cortex-chat-ingestion')).resolves.toMatchObject({
            availability: 'enabled',
            disabledReason: null,
            slug: 'cortex-chat-ingestion',
        });
    });

    test('reconciles embedding schedules after OpenAI API access is saved', async () => {
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        await expect(getRuntimeJob('cortex-generate-embeddings')).resolves.toMatchObject({
            availability: 'disabled',
            schedule: {
                nextRunAt: null,
            },
            slug: 'cortex-generate-embeddings',
        });

        mockEmbeddingModelVisibility();
        await saveTestOpenAiKey();

        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-generate-embeddings');
            return job.availability === 'enabled' && hasNextScheduledRun(job.schedule);
        });
        await expect(getRuntimeJob('cortex-generate-embeddings')).resolves.toMatchObject({
            availability: 'enabled',
            disabledReason: null,
            slug: 'cortex-generate-embeddings',
        });
    });

    test('reconciles Codex-backed Cortex schedules after Codex OAuth becomes available', async () => {
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        await expect(getRuntimeJob('cortex-dream')).resolves.toMatchObject({
            availability: 'disabled',
            schedule: {
                nextRunAt: null,
            },
            slug: 'cortex-dream',
        });
        await expect(getRuntimeJob('cortex-chat-ingestion')).resolves.toMatchObject({
            availability: 'disabled',
            schedule: {
                nextRunAt: null,
            },
            slug: 'cortex-chat-ingestion',
        });

        const codexHome = path.join(runtimeRoot, 'codex-home');
        await mkdir(codexHome, { recursive: true });
        await writeFile(
            path.join(codexHome, 'auth.json'),
            JSON.stringify({
                tokens: {
                    access_token: 'codex-access-token',
                    account_id: 'account-1',
                },
            })
        );
        process.env.CODEX_HOME = codexHome;

        await refreshRuntimeCapabilities({ ids: ['codexOAuth'] });
        await reconcileRuntimeJobSchedules();

        await waitFor(async () => {
            const dreamJob = await getRuntimeJob('cortex-dream');
            const chatIngestionJob = await getRuntimeJob('cortex-chat-ingestion');
            return (
                dreamJob.availability === 'enabled' &&
                hasNextScheduledRun(dreamJob.schedule) &&
                chatIngestionJob.availability === 'enabled' &&
                hasNextScheduledRun(chatIngestionJob.schedule)
            );
        });
    });

    test('disables Cortex embedding generation with a generic missing capability reason', async () => {
        mockEmbeddingModelVisibility();
        await saveTestOpenAiKey();
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
        await saveTestOpenAiKey();
        await store.capture({
            content: 'Runtime jobs should refresh Cortex embeddings.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
            },
            tags: [],
            title: 'Runtime Job Indexing',
            type: 'fact',
        });

        const queued = await store.getPage('runtime-job-indexing');
        expect(queued?.indexing.status).toBe('needs-indexing');
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        const result = await runRuntimeJob('cortex-generate-embeddings');

        expect(result.jobId).toBeTruthy();
        await waitFor(
            async () => (await store.getPage('runtime-job-indexing'))?.indexing.status === 'ready'
        );
        expect((await store.getPage('runtime-job-indexing'))?.indexing).toMatchObject({
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
        mockEmbeddingModelVisibility();
        await saveTestOpenAiKey();
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
        await store.capture({
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

    test('runs Cortex Dream through the Runtime jobs queue', async () => {
        const codexHome = path.join(runtimeRoot, 'codex-home');
        await mkdir(codexHome, { recursive: true });
        await writeFile(
            path.join(codexHome, 'auth.json'),
            JSON.stringify({
                tokens: {
                    access_token: 'codex-access-token',
                    account_id: 'account-1',
                },
            })
        );
        process.env.CODEX_HOME = codexHome;
        await captureCortex(getCortexDb(), {
            content:
                'Dream should preserve durable Cortex memories with source-backed provenance. It should consolidate this into a durable page.',
            source: {
                actorId: 'user-1',
                actorKind: 'user',
                chatId: 'chat-dream-1',
                messageId: 'msg-dream-1',
            },
            tags: ['memory'],
            title: 'Dream Provenance Source',
            type: 'note',
        });
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        output_text: JSON.stringify({
                            citations: [
                                {
                                    locator: 'msg-dream-1',
                                    pageSlug: 'dream-provenance',
                                    quote: 'source-backed provenance',
                                },
                            ],
                            noops: [],
                            observations: [
                                {
                                    confidence: 0.9,
                                    pageSlug: 'dream-provenance',
                                    predicate: 'should_capture',
                                    status: 'active',
                                    subject: 'Dream',
                                    value: 'durable Cortex memories with source-backed provenance',
                                },
                            ],
                            pageWrites: [
                                {
                                    action: 'upsert',
                                    body: 'Dream should capture durable Cortex memories with source-backed provenance.',
                                    compiledTruth:
                                        'Dream should capture durable Cortex memories with source-backed provenance.',
                                    slug: 'dream-provenance',
                                    tags: ['memory'],
                                    title: 'Dream Provenance',
                                    type: 'note',
                                },
                            ],
                            relationships: [],
                            timelineEntries: [
                                {
                                    body: 'Zach asked Dream to preserve source-backed provenance.',
                                    pageSlug: 'dream-provenance',
                                },
                            ],
                            warnings: [],
                        }),
                        usage: {
                            input_tokens: 32,
                            output_tokens: 64,
                        },
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );
        await refreshRuntimeCapabilities({ ids: ['codexOAuth'] });
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        const result = await runRuntimeJob('cortex-dream');

        expect(result.jobId).toBeTruthy();
        await waitFor(async () => {
            const page = await getCortexPage(getCortexDb(), 'dream-provenance');
            return page?.compiledTruth.includes('source-backed provenance') ?? false;
        });
        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-dream');
            return job.latestRun?.state === 'completed';
        });
        const page = await getCortexPage(getCortexDb(), 'dream-provenance');
        expect(page).toMatchObject({
            compiledTruth:
                'Dream should capture durable Cortex memories with source-backed provenance.',
            slug: 'dream-provenance',
            title: 'Dream Provenance',
            type: 'note',
        });
        expect(page?.sourceRefs[0]).toMatchObject({
            locator: 'msg-dream-1',
        });
        expect(page?.timeline[0]).toMatchObject({
            body: 'Zach asked Dream to preserve source-backed provenance.',
            sourceRefs: [expect.objectContaining({ locator: 'msg-dream-1' })],
        });
        const citation = await getCortexDb()
            .prepare('SELECT locator, quote FROM cortex_citations LIMIT 1')
            .get<{ locator: string; quote: string }>();
        expect(citation).toMatchObject({
            locator: 'msg-dream-1',
            quote: 'source-backed provenance',
        });
        await expect(getRuntimeJob('cortex-dream')).resolves.toMatchObject({
            latestRun: {
                state: 'completed',
            },
            slug: 'cortex-dream',
        });
        const audit = await getCortexDb()
            .prepare(
                `SELECT kind, status, summary
                 FROM cortex_audit_events
                 WHERE kind = 'dream.review'
                 ORDER BY created_at DESC
                 LIMIT 1`
            )
            .get<{ kind: string; status: string; summary: string }>();
        expect(audit).toMatchObject({
            kind: 'dream.review',
            status: 'success',
            summary: expect.stringContaining('Dream consolidated'),
        });
        const reports = await listCortexDreamReports(getCortexDb());
        expect(reports[0]).toMatchObject({
            healthAfter: expect.objectContaining({
                issueCount: expect.any(Number),
                score: expect.any(Number),
            }),
            healthBefore: expect.objectContaining({
                issueCount: expect.any(Number),
                score: expect.any(Number),
            }),
            items: expect.arrayContaining([
                expect.objectContaining({
                    kind: 'page-updated',
                    pageSlug: 'dream-provenance',
                    title: 'Dream Provenance',
                }),
            ]),
            phases: expect.arrayContaining([
                expect.objectContaining({ name: 'Sync', status: 'success' }),
                expect.objectContaining({ name: 'Maintenance', status: 'success' }),
                expect.objectContaining({ name: 'Consolidate', status: 'success' }),
                expect.objectContaining({ name: 'Final health', status: 'success' }),
            ]),
            status: 'success',
        });
        expect(fetchSpy).toHaveBeenCalled();
    });

    test('runs Cortex Chat Ingestion through the Runtime jobs queue', async () => {
        const codexHome = path.join(runtimeRoot, 'codex-home');
        await mkdir(codexHome, { recursive: true });
        await writeFile(
            path.join(codexHome, 'auth.json'),
            JSON.stringify({
                tokens: {
                    access_token: 'codex-access-token',
                    account_id: 'account-1',
                },
            })
        );
        process.env.CODEX_HOME = codexHome;
        insertChatMessage({
            chatId: 'chat-ingestion-1',
            content:
                'Remember that chat ingestion should catch durable preference updates quickly.',
            id: 'msg-chat-ingestion-1',
            role: 'user',
            title: 'Chat Ingestion Test',
        });
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            async () =>
                new Response(
                    JSON.stringify({
                        output_text: JSON.stringify({
                            citations: [
                                {
                                    locator: 'msg-chat-ingestion-1',
                                    pageSlug: 'chat-ingestion-preferences',
                                    quote: 'durable preference updates quickly',
                                },
                            ],
                            noops: [],
                            observations: [
                                {
                                    confidence: 0.9,
                                    pageSlug: 'chat-ingestion-preferences',
                                    predicate: 'should_capture',
                                    status: 'active',
                                    subject: 'Cortex Chat Ingestion',
                                    value: 'durable preference updates quickly',
                                },
                            ],
                            pageWrites: [
                                {
                                    action: 'upsert',
                                    body: 'Cortex Chat Ingestion should catch durable preference updates quickly.',
                                    compiledTruth:
                                        'Cortex Chat Ingestion should catch durable preference updates quickly.',
                                    slug: 'chat-ingestion-preferences',
                                    tags: ['chat-ingestion'],
                                    title: 'Chat Ingestion Preferences',
                                    type: 'note',
                                },
                            ],
                            relationships: [],
                            timelineEntries: [
                                {
                                    body: 'Zach asked chat ingestion to capture preference updates quickly.',
                                    pageSlug: 'chat-ingestion-preferences',
                                },
                            ],
                            warnings: [],
                        }),
                        usage: {
                            input_tokens: 24,
                            output_tokens: 48,
                        },
                    }),
                    {
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    }
                )
        );
        await refreshRuntimeCapabilities({ ids: ['codexOAuth'] });
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        const result = await runRuntimeJob('cortex-chat-ingestion');

        expect(result.jobId).toBeTruthy();
        await waitFor(async () => {
            const page = await getCortexPage(getCortexDb(), 'chat-ingestion-preferences');
            return page?.compiledTruth.includes('preference updates quickly') ?? false;
        });
        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-chat-ingestion');
            return job.latestRun?.state === 'completed';
        });
        const page = await getCortexPage(getCortexDb(), 'chat-ingestion-preferences');
        expect(page).toMatchObject({
            compiledTruth: 'Cortex Chat Ingestion should catch durable preference updates quickly.',
            slug: 'chat-ingestion-preferences',
            title: 'Chat Ingestion Preferences',
            type: 'note',
        });
        expect(page?.sourceRefs[0]).toMatchObject({
            locator: 'msg-chat-ingestion-1',
        });
        expect(page?.timeline[0]).toMatchObject({
            body: 'Zach asked chat ingestion to capture preference updates quickly.',
            sourceRefs: [expect.objectContaining({ locator: 'msg-chat-ingestion-1' })],
        });
        const cursor = await getCortexDb()
            .prepare(
                `SELECT last_processed_message_id, last_processed_sequence
                 FROM cortex_chat_ingestion_cursors
                 WHERE chat_id = 'chat-ingestion-1'`
            )
            .get<{ last_processed_message_id: string; last_processed_sequence: number }>();
        expect(cursor).toMatchObject({
            last_processed_message_id: 'msg-chat-ingestion-1',
            last_processed_sequence: 1,
        });
        const citation = await getCortexDb()
            .prepare(
                `SELECT locator, quote
                 FROM cortex_citations
                 WHERE locator = 'msg-chat-ingestion-1'
                 LIMIT 1`
            )
            .get<{ locator: string; quote: string }>();
        expect(citation).toMatchObject({
            locator: 'msg-chat-ingestion-1',
            quote: 'durable preference updates quickly',
        });
        const audit = await getCortexDb()
            .prepare(
                `SELECT kind, status, summary
                 FROM cortex_audit_events
                 WHERE kind = 'chat_ingestion.review'
                 ORDER BY created_at DESC
                 LIMIT 1`
            )
            .get<{ kind: string; status: string; summary: string }>();
        expect(audit).toMatchObject({
            kind: 'chat_ingestion.review',
            status: 'success',
            summary:
                'Cortex Chat Ingestion reviewed 1 message(s) in Chat Ingestion Test and touched 1 page(s).',
        });
        expect(fetchSpy).toHaveBeenCalled();
    });

    test('validates and forwards Runtime job input payloads', async () => {
        mockEmbeddingModelVisibility();
        await saveTestOpenAiKey();
        await refreshRuntimeCapabilities({ ids: ['embeddingModel'] });
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        await expect(
            runRuntimeJob('cortex-generate-embeddings', { stale: 'false' })
        ).rejects.toThrow();

        const result = await runRuntimeJob('cortex-generate-embeddings', { stale: false });

        expect(result.jobId).toBeTruthy();
        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-generate-embeddings');
            return job.latestRun?.state === 'failed';
        });
        const failedJob = await getRuntimeJob('cortex-generate-embeddings');
        expect(failedJob.latestRun).toMatchObject({
            error: expect.stringContaining('stale-only embedding generation'),
            state: 'failed',
        });
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
        await saveTestOpenAiKey();
        await store.capture({
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

        await waitFor(
            async () => (await store.getPage('startup-job-indexing'))?.indexing.status === 'ready'
        );
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

    test('runs Cortex Sync on startup and projects managed markdown', async () => {
        writeCanonicalCortexMarkdownDraft({
            aliases: [],
            body: 'Startup sync should project managed markdown into Cortex PGLite.',
            compiledTruth: 'Startup sync projects managed markdown into Cortex PGLite.',
            id: 'ctxp_startup_sync_projection',
            slug: 'startup-sync-projection',
            sourceRefs: [],
            status: 'active',
            tags: ['test'],
            timeline: [],
            title: 'Startup Sync Projection',
            type: 'note',
            updatedAt: new Date().toISOString(),
        });

        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: jobsPath,
        });

        await waitFor(async () => {
            const page = await getCortexPage(getCortexDb(), 'startup-sync-projection');
            return (
                page?.compiledTruth === 'Startup sync projects managed markdown into Cortex PGLite.'
            );
        });
        await waitFor(async () => {
            const job = await getRuntimeJob('cortex-sync');
            return job.latestRun?.state === 'completed';
        });
        await expect(getRuntimeJob('cortex-sync')).resolves.toMatchObject({
            latestRun: {
                state: 'completed',
            },
            slug: 'cortex-sync',
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

function hasNextScheduledRun(schedule: { kind: string; nextRunAt?: string | null }): boolean {
    return schedule.kind === 'interval' && Boolean(schedule.nextRunAt);
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

async function saveTestOpenAiKey() {
    await handleTavernRuntimeRequest(
        new Request('http://runtime.test/model-access/openai', {
            body: JSON.stringify({ apiKey: 'sk-test-cortex-000000000000' }),
            headers: { 'content-type': 'application/json' },
            method: 'PUT',
        })
    );
}

function createCortexHarness() {
    return {
        capture: (input: Parameters<typeof captureCortex>[1]) =>
            captureCortex(getCortexDb(), input),
        getPage: (slugOrId: string) => getCortexPage(getCortexDb(), slugOrId),
        saveSettings: (input: Parameters<typeof saveCortexSettings>[1]) =>
            saveCortexSettings(getCortexDb(), input),
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

function insertChatMessage(input: {
    chatId: string;
    content: string;
    id: string;
    role: 'assistant' | 'system' | 'user';
    title?: string;
}) {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO chats (id, title, created_at, updated_at, last_message_sequence)
             VALUES ($chatId, $title, $now, $now, 1)`
        )
        .run(namedParams({ chatId: input.chatId, now, title: input.title ?? 'Dream Test' }));
    getDb()
        .prepare(
            `INSERT INTO chat_messages
             (id, chat_id, sequence, author_id, role, content, created_at, metadata_json)
             VALUES ($id, $chatId, 1, 'user-1', $role, $content, $now, '{}')`
        )
        .run(
            namedParams({
                chatId: input.chatId,
                content: input.content,
                id: input.id,
                now,
                role: input.role,
            })
        );
}
