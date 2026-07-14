import * as React from 'react';
import type { CronGetOutput, CronRunsOutput } from '../../lib/trpc.tsx';

type CronJob = NonNullable<CronGetOutput['job']>;
type CronRun = CronRunsOutput['runs'][number];

export function createOptimisticCronRun(job: CronJob, now = new Date()): CronRun {
    const timestamp = now.toISOString();

    return {
        chatId: job.delivery.chatId,
        executionErrorCode: null,
        executionErrorMessage: null,
        finishedAt: null,
        id: `optimistic:${job.id}:${now.getTime()}`,
        jobId: job.id,
        quiet: false,
        scheduledFor: timestamp,
        scriptExitCode: null,
        scriptStderr: null,
        startedAt: timestamp,
        status: 'running',
        trigger: 'manual',
        turnId: null,
    };
}

export function mergeOptimisticCronRuns(
    runs: CronRunsOutput['runs'],
    optimisticRun: CronRun | null
): CronRunsOutput['runs'] {
    if (!optimisticRun || hasRealRunAfter(runs, optimisticRun)) {
        return runs;
    }

    return [optimisticRun, ...runs.filter((run) => run.id !== optimisticRun.id)];
}

export function useOptimisticCronRuns(job: CronGetOutput['job'], runs: CronRunsOutput['runs']) {
    const [optimisticRun, setOptimisticRun] = React.useState<CronRun | null>(null);
    const jobId = job?.id ?? null;

    React.useEffect(() => {
        if (optimisticRun && hasRealRunAfter(runs, optimisticRun)) {
            setOptimisticRun(null);
        }
    }, [optimisticRun, runs]);

    React.useEffect(() => {
        if (optimisticRun && optimisticRun.jobId !== jobId) {
            setOptimisticRun(null);
        }
    }, [jobId, optimisticRun]);

    const recordManualRun = React.useCallback(() => {
        if (!job) {
            return null;
        }
        const run = createOptimisticCronRun(job);
        setOptimisticRun(run);
        return run.id;
    }, [job]);

    const markManualRunFailed = React.useCallback((id: string | null) => {
        if (!id) {
            return;
        }

        setOptimisticRun((run) =>
            run?.id === id
                ? {
                      ...run,
                      executionErrorMessage: 'Manual run request failed.',
                      finishedAt: new Date().toISOString(),
                      status: 'error',
                  }
                : run
        );
    }, []);

    return {
        markManualRunFailed,
        recordManualRun,
        runs: React.useMemo(
            () => mergeOptimisticCronRuns(runs, optimisticRun),
            [runs, optimisticRun]
        ),
    };
}

function hasRealRunAfter(runs: CronRunsOutput['runs'], optimisticRun: CronRun) {
    const optimisticAt = Date.parse(optimisticRun.scheduledFor);

    if (!Number.isFinite(optimisticAt)) {
        return false;
    }

    return runs.some((run) => {
        if (run.id === optimisticRun.id || run.jobId !== optimisticRun.jobId) {
            return false;
        }

        const runAt = Date.parse(run.startedAt ?? run.scheduledFor);
        return Number.isFinite(runAt) && runAt >= optimisticAt;
    });
}
