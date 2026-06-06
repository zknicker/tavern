import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { refreshRuntimeCapabilities } from './capabilities/store';
import { printHelp, runCortexCli } from './cli';
import { ensureCortexRuntimeBootstrap } from './cortex/bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from './cortex/db';
import { closeDb, initTestDb } from './db/connection';
import { ensureRuntimeSchema } from './db/schema';
import type { RuntimeJobsManager } from './jobs/manager';
import { startRuntimeJobsManager } from './jobs/manager';
import { ensureRuntimeJobsSchema } from './jobs/schema';
import { getRuntimeJob } from './jobs/service';
import { handleTavernRuntimeRequest } from './tavern/router';

describe('Tavern Runtime CLI', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('prints Cortex CLI help with command examples', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        printHelp();

        const help = String(logSpy.mock.calls[0]?.[0] ?? '');
        expect(help).toContain('Tavern Runtime');
        expect(help).toContain('tavern cortex graph-query <slug>');
        expect(help).toContain('tavern cortex ingest <kind>');
        expect(help).toContain('tavern cortex history <slug>');
        expect(help).toContain('tavern cortex search diagnose <query> --target <slug>');
        expect(help).not.toContain('tavern cortex import');
        expect(help).not.toContain('tavern cortex extract');
        expect(help).toContain('Cortex commands:');
        expect(help).toContain('Options:');
        expect(help).toContain('Examples:');
    });

    test('waits for cortex embed job completion', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            jsonResponse({
                jobId: 'job-embed-1',
            })
        );
        fetchSpy.mockResolvedValueOnce(
            jsonResponse({
                availability: 'enabled',
                counts: {
                    active: 0,
                    completed: 1,
                    delayed: 0,
                    failed: 0,
                    waiting: 0,
                },
                description: 'Generates embeddings for missing or stale Cortex chunks.',
                disabledReason: null,
                displayName: 'Generate Cortex Embeddings',
                latestRun: null,
                queueName: 'cortex-generate-embeddings',
                recentRuns: [
                    {
                        attemptsMade: 1,
                        createdAt: '2026-06-04T12:00:00.000Z',
                        durationMs: 25,
                        error: null,
                        finishedAt: '2026-06-04T12:00:01.000Z',
                        id: 'job-embed-1',
                        logs: ['Generated embeddings for 2 Cortex chunk(s).'],
                        progress: 100,
                        startedAt: '2026-06-04T12:00:00.000Z',
                        state: 'completed',
                    },
                ],
                schedule: {
                    everyMs: 900_000,
                    kind: 'interval',
                    nextRunAt: null,
                    runOnStart: true,
                },
                slug: 'cortex-generate-embeddings',
            })
        );
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await runCortexCli(['embed', '--stale', '--runtime-url', 'http://runtime.test']);

        expect(fetchSpy).toHaveBeenCalledWith(
            new URL('/jobs/cortex-generate-embeddings/run', 'http://runtime.test'),
            expect.objectContaining({
                body: JSON.stringify({ payload: { stale: true } }),
                method: 'POST',
            })
        );
        expect(fetchSpy).toHaveBeenCalledWith(
            new URL('/jobs/cortex-generate-embeddings', 'http://runtime.test'),
            expect.objectContaining({ method: 'GET' })
        );
        expect(logSpy).toHaveBeenCalledWith('Generated embeddings for 2 Cortex chunk(s).');
    });
});

describe('Tavern Runtime CLI e2e', () => {
    let jobs: RuntimeJobsManager | null = null;
    let runtimeRoot: string;

    beforeEach(async () => {
        runtimeRoot = await mkdtemp(path.join(tmpdir(), 'tavern-cli-e2e-'));
        process.env.CODEX_HOME = path.join(runtimeRoot, 'codex-home');
        process.env.TAVERN_CORTEX_WIKI_PATH = path.join(runtimeRoot, 'wiki');
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
        vi.spyOn(globalThis, 'fetch').mockImplementation(routeRuntimeAndEmbeddingRequests);
        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/model-access/openai', {
                body: JSON.stringify({ apiKey: 'sk-test-cortex-000000000000' }),
                headers: { 'content-type': 'application/json' },
                method: 'PUT',
            })
        );
        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/model-access/openrouter', {
                body: JSON.stringify({ apiKey: 'sk-or-v1-testtesttesttesttest' }),
                headers: { 'content-type': 'application/json' },
                method: 'PUT',
            })
        );
        await refreshRuntimeCapabilities({ ids: ['embeddingModel'] });
        jobs = await startRuntimeJobsManager({
            clearQueuesOnStop: true,
            jobsDatabasePath: path.join(runtimeRoot, 'runtime.jobs.sqlite'),
        });
        await waitFor(async () => {
            const latest = (await getRuntimeJob('cortex-generate-embeddings')).latestRun;
            return latest?.state === 'completed' || latest?.state === 'failed';
        });
    }, 20_000);

    afterEach(async () => {
        await jobs?.stop();
        jobs = null;
        vi.restoreAllMocks();
        closeDb();
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(runtimeRoot, { force: true, recursive: true });
    }, 20_000);

    test('captures, searches, recalls, embeds, and reports Cortex status through Runtime', async () => {
        const output = spyCliOutput();
        const runtimeArgs = ['--runtime-url', 'http://runtime.test'];

        await runCortexCli([
            'capture',
            'Mercury launch windows are tracked in the Cortex Step 1 live test.',
            '--title',
            'Mercury Launch',
            '--type',
            'note',
            '--tag',
            'step-1',
            ...runtimeArgs,
        ]);
        expect(output.stdout()).toContain('Captured mercury-launch');

        output.clear();
        await runCortexCli([
            'capture',
            'Apollo deployment checklists live in this Cortex recall expansion test.',
            '--title',
            'Apollo Deployment',
            '--type',
            'note',
            ...runtimeArgs,
        ]);
        expect(output.stdout()).toContain('Captured apollo-deployment');

        output.clear();
        await runCortexCli([
            'put',
            'orion-brief',
            'Orion brief body links future work.',
            '--title',
            'Orion Brief',
            '--type',
            'note',
            '--tag',
            'brief',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson().pages[0]).toMatchObject({
            slug: 'orion-brief',
            tags: ['brief'],
            title: 'Orion Brief',
        });

        output.clear();
        await runCortexCli([
            'ingest',
            'article',
            'Shortcut source ingestion keeps article context searchable.',
            '--locator',
            'https://example.com/shortcut-source',
            '--title',
            'Shortcut Source',
            '--tag',
            'source-test',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson()).toMatchObject({
            page: {
                slug: 'shortcut-source',
                sourceRefs: [
                    expect.objectContaining({
                        kind: 'article',
                        locator: 'https://example.com/shortcut-source',
                    }),
                ],
                tags: ['source-test'],
            },
            sourceRef: {
                kind: 'article',
                locator: 'https://example.com/shortcut-source',
            },
        });

        output.clear();
        await runCortexCli(['get', 'orion-brief', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            body: 'Orion brief body links future work.',
            slug: 'orion-brief',
        });

        output.clear();
        await runCortexCli(['list', '--json', ...runtimeArgs]);
        expect(output.lastJson().pages.map((page: { slug: string }) => page.slug)).toContain(
            'orion-brief'
        );

        output.clear();
        await runCortexCli(['tag', 'orion-brief', 'priority', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            slug: 'orion-brief',
            tags: ['brief', 'priority'],
        });

        output.clear();
        await runCortexCli(['tags', 'orion-brief', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            tags: ['brief', 'priority'],
        });

        output.clear();
        await runCortexCli(['untag', 'orion-brief', 'brief', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            tags: ['priority'],
        });

        output.clear();
        await runCortexCli([
            'link',
            'orion-brief',
            'apollo-deployment',
            '--type',
            'related_to',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson().pages[0].links[0]).toMatchObject({
            linkKind: 'related_to',
            targetSlug: 'apollo-deployment',
        });

        output.clear();
        await runCortexCli([
            'link',
            'apollo-deployment',
            'mercury-launch',
            '--type',
            'related_to',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson().pages[0].links[0]).toMatchObject({
            linkKind: 'related_to',
            targetSlug: 'mercury-launch',
        });

        output.clear();
        await runCortexCli(['backlinks', 'apollo-deployment', '--json', ...runtimeArgs]);
        expect(output.lastJson().links[0]).toMatchObject({
            linkKind: 'related_to',
            targetSlug: 'apollo-deployment',
        });

        output.clear();
        await runCortexCli([
            'graph-query',
            'orion-brief',
            '--depth',
            '2',
            '--json',
            ...runtimeArgs,
        ]);
        const graphPaths = output.lastJson().paths;
        expect(graphPaths).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    depth: 1,
                    fromSlug: 'orion-brief',
                    linkKind: 'related_to',
                    toSlug: 'apollo-deployment',
                }),
                expect.objectContaining({
                    depth: 2,
                    fromSlug: 'apollo-deployment',
                    linkKind: 'related_to',
                    toSlug: 'mercury-launch',
                }),
            ])
        );

        output.clear();
        await runCortexCli([
            'graph-query',
            'mercury-launch',
            '--depth',
            '1',
            '--direction',
            'in',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson().paths).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    depth: 1,
                    fromSlug: 'apollo-deployment',
                    linkKind: 'related_to',
                    toSlug: 'mercury-launch',
                }),
            ])
        );

        output.clear();
        await runCortexCli([
            'graph-query',
            'apollo-deployment',
            '--depth',
            '1',
            '--direction',
            'both',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson().paths).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    depth: 1,
                    fromSlug: 'orion-brief',
                    linkKind: 'related_to',
                    toSlug: 'apollo-deployment',
                }),
                expect.objectContaining({
                    depth: 1,
                    fromSlug: 'apollo-deployment',
                    linkKind: 'related_to',
                    toSlug: 'mercury-launch',
                }),
            ])
        );

        output.clear();
        await runCortexCli([
            'timeline-add',
            'orion-brief',
            '2026-06-04',
            'Orion',
            'brief',
            'timeline',
            'entry.',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson().pages[0].timeline.at(-1)).toMatchObject({
            body: 'Orion brief timeline entry.',
            createdAt: '2026-06-04T00:00:00.000Z',
        });

        output.clear();
        await runCortexCli(['timeline', 'orion-brief', '--json', ...runtimeArgs]);
        expect(output.lastJson().timeline.at(-1)).toMatchObject({
            body: 'Orion brief timeline entry.',
        });

        output.clear();
        await runCortexCli([
            'unlink',
            'orion-brief',
            'apollo-deployment',
            '--type',
            'related_to',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson()).toMatchObject({
            from: 'orion-brief',
            linkKind: 'related_to',
            to: 'apollo-deployment',
        });

        output.clear();
        await runCortexCli(['delete', 'orion-brief', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            pages: [],
        });

        output.clear();
        await expect(
            runCortexCli(['get', 'orion-brief', '--json', ...runtimeArgs])
        ).rejects.toThrow('Not found');

        output.clear();
        await runCortexCli([
            'put',
            'orion-brief',
            'Orion brief body links future work.',
            '--title',
            'Orion Brief',
            '--tag',
            'priority',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson()).toMatchObject({
            pages: [
                {
                    slug: 'orion-brief',
                    status: 'active',
                },
            ],
        });

        output.clear();
        await runCortexCli(['history', 'orion-brief', '--json', ...runtimeArgs]);
        const history = output.lastJson();
        expect(history.versions.length).toBeGreaterThan(0);

        output.clear();
        await runCortexCli([
            'revert',
            'orion-brief',
            String(history.versions.at(-1).versionNumber),
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson().pages[0]).toMatchObject({
            body: 'Orion brief body links future work.',
            slug: 'orion-brief',
        });

        output.clear();
        await runCortexCli(['health', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toHaveProperty('recommendations');

        output.clear();
        await runCortexCli(['search', 'modes', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            active: 'balanced',
        });

        output.clear();
        await runCortexCli(['search', 'stats', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            pageCount: 4,
        });

        output.clear();
        await runCortexCli(['search', 'shortcut source', '--json', ...runtimeArgs]);
        expect(output.lastJson().hits[0]).toMatchObject({
            page: {
                slug: 'shortcut-source',
            },
        });

        output.clear();
        await runCortexCli(['search', 'mercury launch', '--explain', '--json', ...runtimeArgs]);
        const search = output.lastJson();
        expect(search.hits[0]).toMatchObject({
            diagnostics: {
                evidence: expect.arrayContaining(['lexical']),
                rank: 1,
            },
            page: {
                slug: 'mercury-launch',
                title: 'Mercury Launch',
            },
        });

        output.clear();
        await runCortexCli(['search', 'mercury launch', '--offset', '1', '--json', ...runtimeArgs]);
        expect(output.lastJson()).toMatchObject({
            offset: 1,
        });

        output.clear();
        await runCortexCli([
            'search',
            'diagnose',
            'mercury launch',
            '--target',
            'mercury-launch',
            '--json',
            ...runtimeArgs,
        ]);
        expect(output.lastJson()).toMatchObject({
            target: 'mercury-launch',
            verdict: expect.stringContaining('rank 1'),
        });

        output.clear();
        await runCortexCli(['recall', 'launch windows', '--json', ...runtimeArgs]);
        const recall = output.lastJson();
        expect(recall.hits[0]).toMatchObject({
            page: {
                slug: 'mercury-launch',
            },
        });

        output.clear();
        await runCortexCli([
            'recall',
            'moon schedule',
            '--mode',
            'tokenmax',
            '--json',
            ...runtimeArgs,
        ]);
        const expandedRecall = output.lastJson();
        expect(expandedRecall.hits[0]).toMatchObject({
            page: {
                slug: 'apollo-deployment',
            },
        });

        output.clear();
        await runCortexCli(['status', '--json', ...runtimeArgs]);
        const beforeEmbed = output.lastJson();
        expect(beforeEmbed).toMatchObject({
            chunkCount: 8,
            encoding: {
                currentCount: 0,
                totalCount: 0,
            },
            pageCount: 4,
        });

        output.clear();
        await runCortexCli(['embed', '--stale', ...runtimeArgs]);
        expect(output.stderr()).toContain('cortex-generate-embeddings completed 100%');
        expect(output.stdout()).toContain('Generated embeddings for 8 Cortex chunk(s).');

        output.clear();
        await runCortexCli(['status', '--json', ...runtimeArgs]);
        const afterEmbed = output.lastJson();
        expect(afterEmbed).toMatchObject({
            encoding: {
                currentCount: 8,
                dimensions: 1536,
                model: 'text-embedding-3-small',
                provider: 'openai',
                staleCount: 0,
                totalCount: 8,
            },
            vectorIndex: {
                backend: 'pglite-vector',
                degradedReason: null,
                indexedCount: 8,
            },
        });

        output.clear();
        await runCortexCli(['stats', '--json', ...runtimeArgs]);
        const stats = output.lastJson();
        expect(stats).toMatchObject({
            linkCount: 1,
            pageCount: 4,
            timelineEntryCount: 3,
        });
    }, 20_000);
});

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
        status: 200,
    });
}

async function routeRuntimeAndEmbeddingRequests(
    input: Parameters<typeof fetch>[0],
    init?: RequestInit
) {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'runtime.test') {
        return await handleTavernRuntimeRequest(new Request(url.toString(), init));
    }
    if (url.hostname === 'api.openai.com' && url.pathname === '/v1/models') {
        return jsonResponse({
            data: [{ id: 'text-embedding-3-small' }],
        });
    }
    if (url.hostname === 'api.openai.com' && url.pathname === '/v1/embeddings') {
        return jsonResponse({
            data: [{ embedding: Array.from({ length: 1536 }, () => 0.25) }],
        });
    }
    if (url.hostname === 'openrouter.ai' && url.pathname === '/api/v1/chat/completions') {
        return jsonResponse({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            queries: ['apollo deployment checklist'],
                        }),
                    },
                },
            ],
        });
    }
    return new Response(JSON.stringify({ error: { message: `Unexpected request: ${url}` } }), {
        headers: { 'content-type': 'application/json' },
        status: 500,
    });
}

async function waitFor(
    predicate: () => boolean | Promise<boolean>,
    timeoutMs = 3000
): Promise<void> {
    const startedAt = Date.now();
    while (!(await predicate())) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for condition.');
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

function spyCliOutput() {
    const logs: string[] = [];
    const errors: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message) => {
        logs.push(String(message));
    });
    vi.spyOn(console, 'error').mockImplementation((message) => {
        errors.push(String(message));
    });
    return {
        clear() {
            logs.length = 0;
            errors.length = 0;
        },
        lastJson() {
            const last = logs.at(-1);
            if (!last) {
                throw new Error('Expected CLI JSON output.');
            }
            return JSON.parse(last);
        },
        stderr() {
            return errors.join('\n');
        },
        stdout() {
            return logs.join('\n');
        },
    };
}
