import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { listJobs, runJobUnlessQueued } from '../src/jobs/service.ts';
import type { JobExecution } from '../src/storage/jobs.ts';

afterEach(() => {
    mock.restore();
});

const jobsManager = await import('../src/jobs/manager.ts');
const jobsStorage = await import('../src/storage/jobs.ts');

function createJobBinding(input: {
    active: number;
    add: ReturnType<typeof mock>;
    waiting: number;
}) {
    return {
        definition: {
            defaultInput: {},
            description: 'Reads runtime skill inventory and stores the latest snapshot.',
            displayName: 'Sync Runtime Skills',
            isEnabled: async () => true,
            payloadSchema: {
                parse: (payload: unknown) => payload ?? {},
            },
            schedule: {
                everyMs: 900_000,
                kind: 'interval',
                runOnStart: true,
            },
            slug: 'sync-runtime-skills',
        },
        queue: {
            add: input.add,
            getJobCountsAsync: async () => ({
                active: input.active,
                waiting: input.waiting,
            }),
        },
    } as Awaited<ReturnType<typeof jobsManager.getJobBinding>>;
}

function createExecutionRecord(overrides: Partial<JobExecution> = {}): JobExecution {
    return {
        attemptsMade: 0,
        createdAt: '2026-03-19T19:05:00.000Z',
        error: null,
        finishedAt: null,
        id: 'run-1',
        jobDisplayName: 'Sync OpenRouter Usage',
        jobSlug: 'sync-openrouter-usage',
        logsJson: '[]',
        progress: 0,
        startedAt: null,
        state: 'active',
        updatedAt: '2026-03-19T19:05:00.000Z',
        ...overrides,
    };
}

test('listJobs returns persisted execution records ordered by recency', async () => {
    const waitingLikeRun = createExecutionRecord({
        createdAt: '2026-03-19T19:05:00.000Z',
        id: 'run-active',
        progress: 25,
        startedAt: '2026-03-19T19:05:05.000Z',
        state: 'active',
    });
    const completedRun = createExecutionRecord({
        attemptsMade: 1,
        createdAt: '2026-03-19T18:57:00.000Z',
        finishedAt: '2026-03-19T18:57:02.000Z',
        id: 'run-completed',
        progress: 100,
        startedAt: '2026-03-19T18:57:00.000Z',
        state: 'completed',
    });
    const failedRun = createExecutionRecord({
        attemptsMade: 1,
        createdAt: '2026-03-19T18:52:00.000Z',
        error: 'Missing credentials',
        finishedAt: '2026-03-19T18:52:04.000Z',
        id: 'run-failed',
        progress: 60,
        startedAt: '2026-03-19T18:52:00.000Z',
        state: 'failed',
    });

    spyOn(jobsManager, 'getRegisteredJobDefinitions').mockReturnValue([
        {
            displayName: 'Sync OpenRouter Usage',
            slug: 'sync-openrouter-usage',
        },
    ] as ReturnType<typeof jobsManager.getRegisteredJobDefinitions>);
    spyOn(jobsManager, 'getJobBinding').mockImplementation(() =>
        Promise.resolve({
            definition: {
                description:
                    'Reads OpenRouter activity and stores the latest overview for the dashboard.',
                displayName: 'Sync OpenRouter Usage',
                isEnabled: async () => true,
                schedule: {
                    everyMs: 300_000,
                    kind: 'interval',
                    runOnStart: true,
                },
                slug: 'sync-openrouter-usage',
            },
            queue: {
                getJobScheduler: async () => ({
                    next: Date.parse('2026-03-19T19:10:00.000Z'),
                }),
            },
        } as Awaited<ReturnType<typeof jobsManager.getJobBinding>>)
    );
    spyOn(jobsStorage, 'listRecentJobExecutions').mockImplementation((input) => {
        if (!input.jobSlug) {
            return [waitingLikeRun, completedRun, failedRun];
        }

        return [waitingLikeRun, completedRun, failedRun];
    });

    const result = await listJobs();

    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0]?.latestRun?.id, 'run-active');
    assert.equal('recentRuns' in (result.jobs[0] ?? {}), false);
    assert.deepEqual(result.jobs[0]?.counts, {
        active: 1,
        completed: 1,
        delayed: 0,
        failed: 1,
        waiting: 0,
    });
});

test('runJobUnlessQueued queues one follow-up while the job is active', async () => {
    const add = mock(async () => ({ id: 'job-1' }));
    spyOn(jobsManager, 'getJobBinding').mockImplementation(() =>
        Promise.resolve(
            createJobBinding({
                active: 1,
                add,
                waiting: 0,
            })
        )
    );

    const result = await runJobUnlessQueued('sync-runtime-skills', undefined);

    assert.deepEqual(result, { jobId: 'job-1' });
    assert.equal(add.mock.calls.length, 1);
});

test('runJobUnlessQueued dedupes existing waiting runs', async () => {
    const add = mock(async () => ({ id: 'job-1' }));
    spyOn(jobsManager, 'getJobBinding').mockImplementation(() =>
        Promise.resolve(
            createJobBinding({
                active: 1,
                add,
                waiting: 1,
            })
        )
    );

    const result = await runJobUnlessQueued('sync-runtime-skills', undefined);

    assert.equal(result, null);
    assert.equal(add.mock.calls.length, 0);
});
