import { expect, test } from 'bun:test';
import type { CronGetOutput, CronRunsOutput } from '../../lib/trpc.tsx';
import { createOptimisticCronRun, mergeOptimisticCronRuns } from './use-optimistic-cron-runs.ts';

type CronJob = NonNullable<CronGetOutput['job']>;
type CronRun = CronRunsOutput['runs'][number];

const job = {
    delivery: { chatId: 'cht_general' },
    id: 'cron:joke',
} as CronJob;

function realRun(overrides: Partial<CronRun> = {}): CronRun {
    return {
        chatId: 'cht_general',
        executionErrorCode: null,
        executionErrorMessage: null,
        finishedAt: '2026-06-09T14:00:05.000Z',
        id: 'cron_joke_20260609_140000',
        jobId: 'cron:joke',
        scheduledFor: '2026-06-09T14:00:00.000Z',
        startedAt: '2026-06-09T14:00:00.000Z',
        status: 'success',
        trigger: 'schedule',
        turnId: 'turn:joke',
        ...overrides,
    };
}

test('createOptimisticCronRun builds a local manual pending row', () => {
    const run = createOptimisticCronRun(job, new Date('2026-06-09T14:00:00.000Z'));

    expect(run).toMatchObject({
        chatId: 'cht_general',
        finishedAt: null,
        id: 'optimistic:cron:joke:1781013600000',
        jobId: 'cron:joke',
        scheduledFor: '2026-06-09T14:00:00.000Z',
        status: 'running',
        trigger: 'manual',
        turnId: null,
    });
});

test('mergeOptimisticCronRuns shows the optimistic row until a real run appears', () => {
    const optimistic = createOptimisticCronRun(job, new Date('2026-06-09T14:00:00.000Z'));
    const olderRun = realRun({
        id: 'cron_joke_20260609_135900',
        scheduledFor: '2026-06-09T13:59:00.000Z',
        startedAt: '2026-06-09T13:59:00.000Z',
    });

    expect(mergeOptimisticCronRuns([olderRun], optimistic).map((run) => run.id)).toEqual([
        optimistic.id,
        olderRun.id,
    ]);
});

test('mergeOptimisticCronRuns removes the optimistic row once real history catches up', () => {
    const optimistic = createOptimisticCronRun(job, new Date('2026-06-09T14:00:00.000Z'));
    const replacement = realRun({
        id: 'cron_joke_20260609_140001',
        scheduledFor: '2026-06-09T14:00:01.000Z',
        startedAt: '2026-06-09T14:00:01.000Z',
    });

    expect(mergeOptimisticCronRuns([replacement], optimistic).map((run) => run.id)).toEqual([
        replacement.id,
    ]);
});
