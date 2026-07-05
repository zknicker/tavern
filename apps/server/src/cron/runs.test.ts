import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'tavern-cron-runs-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [
    { ensureDatabaseSchema },
    { databaseClient },
    { upsertCronRuns },
    agentRuntimeSync,
    { listCronRuns },
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('../storage/cron-runs.ts'),
    import('../sync/agent-runtime-sync.ts'),
    import('./runs.ts'),
]);

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM cron_runs;');
    databaseClient.exec('DELETE FROM cron_jobs;');
});

test('listCronRuns returns mapped runtime runs and honors the limit', async () => {
    const syncSpy = spyOn(agentRuntimeSync, 'syncAgentRuntimeCron').mockImplementation(
        async () => []
    );
    await upsertCronRuns([
        {
            chatId: 'chat:standup',
            executionErrorCode: null,
            executionErrorMessage: null,
            finishedAt: '2026-04-16T12:02:25.000Z',
            id: 'run-2',
            jobId: 'cron:standup',
            runtimeId: 'runtime-1',
            scheduledFor: '2026-04-16T12:01:00.000Z',
            startedAt: '2026-04-16T12:01:00.000Z',
            status: 'success',
            syncedAt: '2026-04-16T12:02:30.000Z',
            trigger: 'manual',
            turnId: 'turn-2',
        },
        {
            chatId: null,
            executionErrorCode: 'execution_failed',
            executionErrorMessage: 'Provider timeout',
            finishedAt: '2026-04-16T11:02:25.000Z',
            id: 'run-1',
            jobId: 'cron:standup',
            runtimeId: 'runtime-1',
            scheduledFor: '2026-04-16T11:01:00.000Z',
            startedAt: '2026-04-16T11:01:00.000Z',
            status: 'error',
            syncedAt: '2026-04-16T11:02:30.000Z',
            trigger: 'schedule',
            turnId: null,
        },
    ]);

    const result = await listCronRuns({
        jobId: 'cron:standup',
        limit: 1,
    });

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({
        chatId: 'chat:standup',
        finishedAt: '2026-04-16T12:02:25.000Z',
        id: 'run-2',
        trigger: 'manual',
        turnId: 'turn-2',
    });
    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy.mock.calls[0]?.[0]).toEqual({ emitUpdates: false });
});

test('listCronRuns keeps queued runs without chat or turn linkage', async () => {
    await upsertCronRuns([
        {
            chatId: null,
            executionErrorCode: null,
            executionErrorMessage: null,
            finishedAt: null,
            id: 'run-queued',
            jobId: 'cron:standup',
            runtimeId: 'runtime-1',
            scheduledFor: '2026-04-16T12:01:00.000Z',
            startedAt: null,
            status: 'queued',
            syncedAt: '2026-04-16T12:02:00.000Z',
            trigger: 'manual',
            turnId: null,
        },
    ]);

    const result = await listCronRuns({
        jobId: 'cron:standup',
        limit: 1,
    });

    expect(result.runs[0]).toMatchObject({
        chatId: null,
        id: 'run-queued',
        status: 'queued',
        turnId: null,
    });
});
