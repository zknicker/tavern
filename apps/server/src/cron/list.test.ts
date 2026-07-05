import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'tavern-cron-list-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [
    { ensureDatabaseSchema },
    { databaseClient },
    { saveCronJobRecord },
    { upsertCronRuns },
    agentRuntimeSync,
    { getCronJob, listCronJobs },
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('../storage/cron-jobs.ts'),
    import('../storage/cron-runs.ts'),
    import('../sync/agent-runtime-sync.ts'),
    import('./list.ts'),
]);

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM cron_runs;');
    databaseClient.exec('DELETE FROM cron_jobs;');
});

test('listCronJobs promotes latest failed run state for list badges', async () => {
    spyOn(agentRuntimeSync, 'syncAgentRuntimeCron').mockImplementation(async () => []);
    await saveCronJobRecord({
        job: {
            agentId: 'agent-1',
            createdAt: '2026-06-15T13:00:00.000Z',
            deleteAfterRun: false,
            delivery: { chatId: 'chat:morning' },
            description: null,
            enabled: true,
            id: 'cron:morning',
            name: 'Morning briefing',
            payload: {
                kind: 'agentTurn',
                message: 'Summarize overnight changes.',
            },
            schedule: { expr: '0 9 * * *', kind: 'cron' },
            state: {},
            updatedAt: '2026-06-16T13:00:00.000Z',
        },
        runtimeId: 'runtime-1',
        syncedAt: '2026-06-16T13:00:00.000Z',
    });
    await upsertCronRuns([
        {
            chatId: 'chat:morning',
            executionErrorCode: 'execution_failed',
            executionErrorMessage: 'Provider usage exhausted',
            finishedAt: '2026-06-16T13:00:44.000Z',
            id: 'preview_morning_failed',
            jobId: 'cron:morning',
            runtimeId: 'runtime-1',
            scheduledFor: '2026-06-16T13:00:42.000Z',
            startedAt: '2026-06-16T13:00:42.000Z',
            status: 'error',
            syncedAt: '2026-06-16T13:00:44.000Z',
            trigger: 'schedule',
            turnId: 'turn:morning',
        },
    ]);

    const result = await listCronJobs();

    expect(result.jobs[0]?.state).toMatchObject({
        lastErrorCode: 'execution_failed',
        lastErrorMessage: 'Provider usage exhausted',
        lastRunAtMs: Date.parse('2026-06-16T13:00:44.000Z'),
        lastRunStatus: 'error',
    });
});

test('cron reads refresh runtime state without emitting invalidation updates', async () => {
    const syncSpy = spyOn(agentRuntimeSync, 'syncAgentRuntimeCron').mockResolvedValue([]);

    await listCronJobs();
    await getCronJob({ jobId: 'cron:missing' });

    expect(syncSpy.mock.calls.map((call) => call[0])).toEqual([
        { emitUpdates: false },
        { emitUpdates: false },
    ]);
});
