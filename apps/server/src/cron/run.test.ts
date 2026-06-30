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
        delivery: null,
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
        wakeMode: 'now' as const,
    };
}

function createAgentRuntimeCronRun() {
    return {
        deliveryError: null,
        deliveryStatus: 'pending' as const,
        executionErrorCode: null,
        executionErrorMessage: null,
        finishedAt: null,
        id: 'run:daily-standup',
        jobId: 'cron:daily-standup',
        scheduledFor: '2026-04-16T09:00:00.000Z',
        sessionId: null,
        sessionKey: null,
        startedAt: null,
        status: 'queued' as const,
        summary: null,
        trigger: 'manual' as const,
    };
}

function createSyntheticTriggerRun() {
    return {
        ...createAgentRuntimeCronRun(),
        id: 'trigger_cron_daily-standup_1780000000000',
        sessionId: null,
        sessionKey: null,
        status: 'running' as const,
        summary: 'Agent engine queued force cron run.',
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
    assert.equal(runs.runs[0]?.sessionKey, null);
    assert.equal(runs.runs[0]?.trigger, 'manual');
    assert.equal(runs.runs[0]?.status, 'queued');

    const loaded = await getCronJob({
        jobId: 'cron:daily-standup',
    });
    assert.equal(loaded.job?.state.lastRunAtMs, Date.parse('2026-04-16T09:00:00.000Z'));
    assert.equal(loaded.job?.state.lastRunStatus, 'queued');
    assert.equal(emitCronUpdatedSpy.mock.calls.length, 1);
});

test('runCronJob does not persist runtime trigger acknowledgements as run history', async () => {
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
    spyOn(agentRuntimeCron, 'runCronJob').mockResolvedValue(createSyntheticTriggerRun());
    spyOn(invalidationEvents, 'emitCronUpdated').mockImplementation(() => undefined);
    spyOn(agentRuntimeSync, 'syncAgentRuntimeCron').mockResolvedValue([
        {
            deleted: 0,
            runtimeId: 'runtime-1',
            runtimeName: 'Runtime 1',
            synced: 0,
        },
    ]);

    await runCronJob({
        jobId: 'cron:daily-standup',
        mode: 'force',
    });

    const runs = await listCronRuns({
        jobId: 'cron:daily-standup',
    });
    assert.equal(runs.runs.length, 0);
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
