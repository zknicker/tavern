import type { AgentRuntimeCron } from '@tavern/api';
import { getCronJobRecord, parseCronJobRawJson } from '../storage/cron-jobs.ts';
import { listCronRuns as listStoredCronRuns } from '../storage/cron-runs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import {
    type CronJobRun,
    type CronRun,
    cronJobRunListSchema,
    listCronRunsInputSchema,
} from './contracts.ts';

export async function listCronRuns(input?: unknown) {
    const parsed = listCronRunsInputSchema.parse(input);
    await refreshCronState();
    const runs = await listStoredCronRuns(parsed?.jobId ? { jobId: parsed.jobId } : undefined);
    const stateFailureRun = parsed?.jobId
        ? await buildLatestStateFailureRun(parsed.jobId, runs)
        : null;
    const mappedRuns = runs
        .filter((run) => !isCoveredByStateFailureRun(run, stateFailureRun))
        .map(mapStoredCronRun);
    const allRuns = stateFailureRun ? [stateFailureRun, ...mappedRuns] : mappedRuns;
    allRuns.sort(compareCronJobRuns);
    const limit = parsed?.limit ?? allRuns.length;

    return cronJobRunListSchema.parse({
        runs: allRuns.slice(0, limit),
    });
}

async function refreshCronState() {
    try {
        await syncAgentRuntimeCron({ emitUpdates: false });
    } catch (error) {
        console.warn('[tavern] failed to refresh cron runs', error);
    }
}

function resolveFinishedAt(run: { durationMs: null | number; runAt: string }) {
    if (run.durationMs === null) {
        return null;
    }

    const startedAtMs = Date.parse(run.runAt);
    if (Number.isNaN(startedAtMs)) {
        return null;
    }

    return new Date(startedAtMs + run.durationMs).toISOString();
}

function mapStoredCronRun(run: CronRun): CronJobRun {
    const deliveryError = isDeliveryFailure(run.deliveryStatus) ? run.error : null;
    const executionError =
        run.status === 'error' && !deliveryError ? (run.error ?? 'Automation run failed.') : null;

    return {
        deliveryError,
        deliveryStatus: run.deliveryStatus,
        executionErrorCode: executionError ? 'execution_failed' : null,
        executionErrorMessage: executionError,
        finishedAt: resolveFinishedAt(run),
        id: run.sessionKey,
        jobId: run.jobId,
        scheduledFor: run.runAt,
        sessionId: run.sessionId,
        sessionKey: run.runtimeSessionKey ? run.sessionKey : null,
        startedAt: run.runAt,
        status: run.status ?? 'success',
        summary: run.summary,
        trigger: run.trigger,
    };
}

function isDeliveryFailure(status: CronRun['deliveryStatus']) {
    return status === 'failed' || status === 'parent_missing';
}

async function buildLatestStateFailureRun(
    jobId: string,
    storedRuns: CronRun[]
): Promise<CronJobRun | null> {
    const jobRecord = await getCronJobRecord(jobId);
    if (!jobRecord) {
        return null;
    }

    return buildStateFailureRun(jobId, parseCronJobRawJson(jobRecord), storedRuns);
}

export function buildStateFailureRun(
    jobId: string,
    job: AgentRuntimeCron,
    storedRuns: CronRun[]
): CronJobRun | null {
    const lastRunAtMs = job.state.lastRunAtMs;
    if (!lastRunAtMs) {
        return null;
    }

    const stateStatus = job.state.lastRunStatus ?? job.state.lastStatus;
    if (stateStatus !== 'error' && !job.state.lastErrorMessage) {
        return null;
    }

    const newestStoredRunMs = getNewestStoredRunMs(storedRuns);
    if (newestStoredRunMs !== null && newestStoredRunMs > lastRunAtMs + 2000) {
        return null;
    }

    if (
        storedRuns.some((run) => run.status === 'error' && isSameCronOccurrence(run, lastRunAtMs))
    ) {
        return null;
    }

    const occurredAt = new Date(lastRunAtMs).toISOString();
    const errorMessage = job.state.lastErrorMessage ?? 'Automation run failed.';

    return {
        deliveryError: job.state.lastDeliveryError ?? null,
        deliveryStatus:
            job.state.lastDeliveryStatus ?? (job.state.lastDeliveryError ? 'failed' : null),
        executionErrorCode: job.state.lastErrorCode ?? 'execution_failed',
        executionErrorMessage: errorMessage,
        finishedAt: occurredAt,
        id: `state:${jobId}:${lastRunAtMs}`,
        jobId,
        scheduledFor: occurredAt,
        sessionId: null,
        sessionKey: null,
        startedAt: occurredAt,
        status: 'error',
        summary: null,
        trigger: 'schedule',
    };
}

function isCoveredByStateFailureRun(run: CronRun, stateFailureRun: CronJobRun | null) {
    if (!stateFailureRun) {
        return false;
    }

    const stateRunAtMs = Date.parse(stateFailureRun.scheduledFor);
    return Number.isFinite(stateRunAtMs) && isSameCronOccurrence(run, stateRunAtMs);
}

function isSameCronOccurrence(run: CronRun, occurredAtMs: number) {
    const runOccurredAtMs = getStoredRunOccurredAtMs(run);
    return runOccurredAtMs !== null && Math.abs(runOccurredAtMs - occurredAtMs) <= 2000;
}

function getNewestStoredRunMs(runs: CronRun[]) {
    const timestamps = runs
        .map(getStoredRunOccurredAtMs)
        .filter((value): value is number => value !== null);

    return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function getStoredRunOccurredAtMs(run: CronRun) {
    const startedAtMs = Date.parse(run.runAt);
    if (!Number.isFinite(startedAtMs)) {
        return null;
    }

    return run.durationMs === null ? startedAtMs : startedAtMs + run.durationMs;
}

function compareCronJobRuns(left: CronJobRun, right: CronJobRun) {
    return (
        getCronJobRunTimeMs(right) - getCronJobRunTimeMs(left) || right.id.localeCompare(left.id)
    );
}

function getCronJobRunTimeMs(run: CronJobRun) {
    return Date.parse(run.finishedAt ?? run.startedAt ?? run.scheduledFor);
}
