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
    { saveCronJobRecord },
    { reconcileSyntheticCronTriggerRuns, upsertCronRuns },
    agentRuntimeSync,
    { listCronRuns },
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('../storage/cron-jobs.ts'),
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

test('listCronRuns returns mapped runs and honors the limit', async () => {
    const syncSpy = spyOn(agentRuntimeSync, 'syncAgentRuntimeCron').mockImplementation(
        async () => []
    );
    await upsertCronRuns([
        {
            agentId: null,
            deliveryStatus: 'delivered',
            durationMs: 85_000,
            error: null,
            jobId: 'cron:standup',
            providerJobId: 'run-2',
            runAt: '2026-04-16T12:01:00.000Z',
            runtimeId: 'runtime-1',
            runtimeRunId: 'run-2',
            runtimeSessionKey: 'agent:planner:cron:standup:2',
            sessionId: 'session-2',
            sessionKey: 'agent:planner:cron:standup:2',
            status: 'success',
            summary: 'Posted update.',
            syncedAt: '2026-04-16T12:02:00.000Z',
            trigger: 'manual',
        },
        {
            agentId: null,
            deliveryStatus: 'not_applicable',
            durationMs: 85_000,
            error: 'Provider timeout',
            jobId: 'cron:standup',
            providerJobId: 'run-1',
            runAt: '2026-04-16T11:01:00.000Z',
            runtimeId: 'runtime-1',
            runtimeRunId: 'run-1',
            runtimeSessionKey: null,
            sessionId: 'run-1',
            sessionKey: 'run-1',
            status: 'error',
            summary: null,
            syncedAt: '2026-04-16T11:02:00.000Z',
            trigger: 'schedule',
        },
    ]);

    const result = await listCronRuns({
        jobId: 'cron:standup',
        limit: 1,
    });

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]?.id).toBe('agent:planner:cron:standup:2');
    expect(result.runs[0]?.finishedAt).toBe('2026-04-16T12:02:25.000Z');
    expect(result.runs[0]?.sessionKey).toBe('agent:planner:cron:standup:2');
    expect(result.runs[0]?.trigger).toBe('manual');
    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy.mock.calls[0]?.[0]).toEqual({ emitUpdates: false });
});

test('listCronRuns hides session drill-through until a runtime session exists', async () => {
    await upsertCronRuns([
        {
            agentId: null,
            deliveryStatus: 'pending',
            durationMs: null,
            error: null,
            jobId: 'cron:standup',
            providerJobId: 'run-queued',
            runAt: '2026-04-16T12:01:00.000Z',
            runtimeId: 'runtime-1',
            runtimeRunId: 'run-queued',
            runtimeSessionKey: null,
            sessionId: 'run-queued',
            sessionKey: 'run-queued',
            status: 'running',
            summary: 'Queued.',
            syncedAt: '2026-04-16T12:02:00.000Z',
            trigger: 'manual',
        },
    ]);

    const result = await listCronRuns({
        jobId: 'cron:standup',
        limit: 1,
    });

    expect(result.runs[0]?.id).toBe('run-queued');
    expect(result.runs[0]?.sessionKey).toBeNull();
});

test('listCronRuns shows a newer failed job state when stored run history missed it', async () => {
    const syncSpy = spyOn(agentRuntimeSync, 'syncAgentRuntimeCron').mockImplementation(
        async () => []
    );

    await saveCronJobRecord({
        job: {
            agentId: 'agent-1',
            createdAt: '2026-06-15T13:00:00.000Z',
            deleteAfterRun: false,
            delivery: { chatId: 'general' },
            description: null,
            enabled: true,
            id: 'cron:good-morning',
            name: 'Good morning',
            payload: {
                kind: 'agentTurn',
                message: 'Say good morning and summarize what happened yesterday.',
            },
            schedule: { expr: '0 9 * * *', kind: 'cron', tz: 'America/New_York' },
            state: {
                lastErrorCode: 'execution_failed',
                lastErrorMessage: 'RuntimeError: Provider usage exhausted',
                lastRunAtMs: Date.parse('2026-06-16T13:00:42.659Z'),
                lastRunStatus: 'error',
                lastStatus: 'error',
                nextRunAtMs: Date.parse('2026-06-17T13:00:00.000Z'),
            },
            updatedAt: '2026-06-16T13:00:42.659Z',
            wakeMode: 'now',
        },
        runtimeId: 'runtime-1',
        syncedAt: '2026-06-16T13:00:43.000Z',
    });
    await upsertCronRuns([
        {
            agentId: null,
            deliveryStatus: 'delivered',
            durationMs: 668,
            error: null,
            jobId: 'cron:good-morning',
            providerJobId: 'cron_good_morning_20260616_090041',
            runAt: '2026-06-16T13:00:41.904Z',
            runtimeId: 'runtime-1',
            runtimeRunId: 'cron_good_morning_20260616_090041',
            runtimeSessionKey: 'cron_good_morning_20260616_090041',
            sessionId: 'cron_good_morning_20260616_090041',
            sessionKey: 'cron_good_morning_20260616_090041',
            status: 'success',
            summary: 'Posted update.',
            syncedAt: '2026-06-16T13:00:42.700Z',
            trigger: 'schedule',
        },
    ]);

    const result = await listCronRuns({
        jobId: 'cron:good-morning',
        limit: 5,
    });

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({
        executionErrorCode: 'execution_failed',
        executionErrorMessage: 'RuntimeError: Provider usage exhausted',
        finishedAt: '2026-06-16T13:00:42.659Z',
        id: 'state:cron:good-morning:1781614842659',
        jobId: 'cron:good-morning',
        sessionId: null,
        sessionKey: null,
        startedAt: '2026-06-16T13:00:42.659Z',
        status: 'error',
    });
    expect(syncSpy).toHaveBeenCalledTimes(1);
});

test('reconcileSyntheticCronTriggerRuns removes trigger acknowledgements with real runs', async () => {
    await upsertCronRuns([
        {
            agentId: null,
            deliveryStatus: 'pending',
            durationMs: null,
            error: null,
            jobId: 'cron:standup',
            providerJobId: 'trigger_cron_standup_1780000000000',
            runAt: '2026-04-16T12:01:00.000Z',
            runtimeId: 'runtime-1',
            runtimeRunId: 'trigger_cron_standup_1780000000000',
            runtimeSessionKey: null,
            sessionId: 'trigger_cron_standup_1780000000000',
            sessionKey: 'trigger_cron_standup_1780000000000',
            status: 'running',
            summary: 'Agent engine queued force cron run.',
            syncedAt: '2026-04-16T12:01:00.000Z',
            trigger: 'manual',
        },
        {
            agentId: null,
            deliveryStatus: 'delivered',
            durationMs: 4000,
            error: null,
            jobId: 'cron:standup',
            providerJobId: 'cron_standup_20260416_120102',
            runAt: '2026-04-16T12:01:02.000Z',
            runtimeId: 'runtime-1',
            runtimeRunId: 'cron_standup_20260416_120102',
            runtimeSessionKey: 'cron_standup_20260416_120102',
            sessionId: 'cron_standup_20260416_120102',
            sessionKey: 'cron_standup_20260416_120102',
            status: 'success',
            summary: 'Posted update.',
            syncedAt: '2026-04-16T12:01:06.000Z',
            trigger: 'schedule',
        },
    ]);

    const result = await reconcileSyntheticCronTriggerRuns({
        runtimeId: 'runtime-1',
        staleBefore: '2026-04-16T12:11:00.000Z',
        syncedAt: '2026-04-16T12:11:00.000Z',
    });

    const runs = await listCronRuns({
        jobId: 'cron:standup',
        limit: 10,
    });

    expect(result.deleted).toBe(1);
    expect(runs.runs.map((run) => run.id)).toEqual(['cron_standup_20260416_120102']);
});
