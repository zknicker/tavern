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
    { runCronJob },
] = await Promise.all([
    import('../agent-runtime/cron.ts'),
    import('../api/invalidation-events.ts'),
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('../storage/agent-runtime-connections.ts'),
    import('../storage/cron-jobs.ts'),
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

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
    databaseClient.exec('DELETE FROM cron_jobs;');
});

test('runCronJob forwards the manual run request to OpenClaw', async () => {
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
    assert.equal(emitCronUpdatedSpy.mock.calls.length, 1);
});

test('runCronJob rejects missing cron jobs before calling OpenClaw', async () => {
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
