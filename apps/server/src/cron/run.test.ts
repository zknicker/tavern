import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TRPCError } from '@trpc/server';

process.env.DATABASE_PATH = join(
    mkdtempSync(join(tmpdir(), 'tavern-cron-run-test-')),
    'test.sqlite'
);

const [
    agentRuntimeCron,
    invalidationEvents,
    { ensureDatabaseSchema },
    { databaseClient },
    { saveAgentRuntimeConnection },
    { syncCronJobsForRuntime },
    agentRuntimeSync,
    { getCronJob },
    { listCronRuns },
    { runCronJob },
] = await Promise.all([
    import('../agent-runtime/cron.ts'),
    import('../api/invalidation-events.ts'),
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('../storage/agent-runtime-connections.ts'),
    import('../storage/cron-jobs.ts'),
    import('../sync/agent-runtime-sync.ts'),
    import('./list.ts'),
    import('./runs.ts'),
    import('./run.ts'),
]);

await ensureDatabaseSchema();

function createAgentRuntimeCronJob() {
    return {
        agentId: 'agent:planner',
        createdAt: '2026-04-16T00:00:00.000Z',
        deleteAfterRun: false,
        delivery: { chatId: 'chat:standup' },
        description: 'Keep the team aligned.',
        enabled: true,
        id: 'cron:daily-standup',
        name: 'Daily standup',
        payload: {
            kind: 'agentTurn' as const,
            message: 'Post the daily standup update.',
        },
        schedule: {
            expr: '0 9 * * 1-5',
            kind: 'cron' as const,
        },
        state: {},
        updatedAt: '2026-04-16T00:00:00.000Z',
    };
}

function createAgentRuntimeCronRun() {
    return {
        chatId: 'chat:standup',
        executionErrorCode: null,
        executionErrorMessage: null,
        finishedAt: null,
        id: 'run:daily-standup',
        jobId: 'cron:daily-standup',
        quiet: false,
        scheduledFor: '2026-04-16T09:00:00.000Z',
        scriptExitCode: null,
        scriptStderr: null,
        startedAt: null,
        status: 'queued' as const,
        trigger: 'manual' as const,
        turnId: null,
    };
}

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM cron_runs;');
    databaseClient.exec('DELETE FROM cron_jobs;');
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
});

test('runCronJob forwards the manual run request to the agent runtime', async () => {
    await syncCronJobsForRuntime({
        jobs: [createAgentRuntimeCronJob()],
        runtimeId: 'runtime-1',
    });
    await saveAgentRuntimeConnection({
        auth: null,
        baseUrl: 'http://localhost:1234',
        id: 'runtime-1',
        lastCheckedAt: '2026-05-05T19:00:00.000Z',
        lastError: null,
        name: 'Runtime 1',
    });
    const runAgentRuntimeCronSpy = spyOn(agentRuntimeCron, 'runCronJob').mockResolvedValue(
        createAgentRuntimeCronRun()
    );
    const emitCronUpdatedSpy = spyOn(invalidationEvents, 'emitCronUpdated').mockImplementation(
        () => undefined
    );
    spyOn(agentRuntimeSync, 'syncAgentRuntimeCron').mockResolvedValue([
        {
            deleted: 0,
            runtimeId: 'runtime-1',
            runtimeName: 'Runtime 1',
            synced: 0,
        },
    ]);

    const result = await runCronJob({
        jobId: 'cron:daily-standup',
        mode: 'enqueue',
    });

    assert.deepEqual(result, {
        success: true,
        synced: true,
    });
    assert.deepEqual(runAgentRuntimeCronSpy.mock.calls[0]?.slice(0, 2), [
        'cron:daily-standup',
        { mode: 'enqueue' },
    ]);
    const runs = await listCronRuns({
        jobId: 'cron:daily-standup',
    });
    assert.equal(runs.runs.length, 1);
    assert.equal(runs.runs[0]?.id, 'run:daily-standup');
    assert.equal(runs.runs[0]?.chatId, 'chat:standup');
    assert.equal(runs.runs[0]?.trigger, 'manual');
    assert.equal(runs.runs[0]?.status, 'queued');

    const loaded = await getCronJob({
        jobId: 'cron:daily-standup',
    });
    assert.equal(loaded.job?.state.lastRunAtMs, Date.parse('2026-04-16T09:00:00.000Z'));
    assert.equal(loaded.job?.state.lastRunStatus, 'queued');
    assert.equal(emitCronUpdatedSpy.mock.calls.length, 1);
});

test('runCronJob rejects missing cron jobs before calling the runtime', async () => {
    const runAgentRuntimeCronSpy = spyOn(agentRuntimeCron, 'runCronJob').mockResolvedValue(
        createAgentRuntimeCronRun()
    );

    await assert.rejects(
        () =>
            runCronJob({
                jobId: 'cron:missing',
                mode: 'force',
            }),
        (error: unknown) => {
            assert.ok(error instanceof TRPCError);
            assert.equal(error.code, 'NOT_FOUND');
            assert.equal(error.message, 'Cron job not found.');
            return true;
        }
    );

    assert.equal(runAgentRuntimeCronSpy.mock.calls.length, 0);
});
