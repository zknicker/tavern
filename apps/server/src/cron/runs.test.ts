import { afterEach, expect, mock, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'tavern-cron-runs-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [{ ensureDatabaseSchema }, { databaseClient }, { upsertCronRuns }, { listCronRuns }] =
    await Promise.all([
        import('../db/bootstrap.ts'),
        import('../db/index.ts'),
        import('../storage/cron-runs.ts'),
        import('./runs.ts'),
    ]);

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM cron_runs;');
});

test('listCronRuns returns mapped projected runs and honors the limit', async () => {
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
            runtimeSessionKey: 'run-1',
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
    expect(result.runs[0]?.sessionKey).toBe('agent:planner:cron:standup:2');
    expect(result.runs[0]?.trigger).toBe('manual');
});
