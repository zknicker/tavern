import { formatRelativeTime, formatTimestamp } from '../../lib/format.ts';
import type { CronListOutput, CronRunsOutput } from '../../lib/trpc.tsx';

export interface CronExecution {
    deliveryStatus: CronRunsOutput['runs'][number]['deliveryStatus'];
    executionErrorCode: CronRunsOutput['runs'][number]['executionErrorCode'];
    executionErrorMessage: CronRunsOutput['runs'][number]['executionErrorMessage'];
    id: string;
    occurredAt: string;
    occurredAtFormatted: string;
    occurredAtRelative: string;
    sessionKey: string | null;
    status: CronRunsOutput['runs'][number]['status'];
    summary: string | null;
    trigger: CronRunsOutput['runs'][number]['trigger'];
}

type CronJobRecord = CronListOutput['jobs'][number];
type CronRunRecord = CronRunsOutput['runs'][number];

function formatCronSchedule(schedule: CronJobRecord['schedule'], includeEveryLabel = false) {
    if (schedule.kind === 'cron') {
        return schedule.expr;
    }

    if (schedule.kind === 'every') {
        return includeEveryLabel ? `Every ${schedule.everyMs}ms` : `${schedule.everyMs}ms`;
    }

    return schedule.at;
}

function getLastRunAt(job: CronJobRecord) {
    if (job.state.runningAtMs) {
        return new Date(job.state.runningAtMs).toISOString();
    }

    if (job.state.lastRunAtMs) {
        return new Date(job.state.lastRunAtMs).toISOString();
    }

    return null;
}

function getResultLabel(job: CronJobRecord) {
    if (job.state.runningAtMs) {
        return 'running';
    }

    return job.state.lastStatus ?? 'unknown';
}

export function formatCronErrorMessage(message: null | string | undefined) {
    const trimmed = message?.trim();
    if (!trimmed) {
        return null;
    }

    const embeddedMessage = /["']message["']\s*:\s*(["'])(?<message>.+?)\1[},]/u.exec(trimmed)
        ?.groups?.message;

    return embeddedMessage?.trim() || trimmed;
}

function getRunOccurredAt(run: CronRunRecord) {
    if (
        (run.status === 'success' || run.status === 'error' || run.status === 'skipped') &&
        run.finishedAt
    ) {
        return run.finishedAt;
    }

    return run.startedAt ?? run.scheduledFor;
}

function buildExecutions(runs: CronRunRecord[]): CronExecution[] {
    return [...runs]
        .sort(
            (left, right) =>
                new Date(getRunOccurredAt(right)).getTime() -
                new Date(getRunOccurredAt(left)).getTime()
        )
        .slice(0, 8)
        .map((run) => {
            const occurredAt = getRunOccurredAt(run);

            return {
                deliveryStatus: run.deliveryStatus,
                executionErrorCode: run.executionErrorCode,
                executionErrorMessage: run.executionErrorMessage,
                id: run.id,
                occurredAt,
                occurredAtFormatted: formatTimestamp(occurredAt),
                occurredAtRelative: formatRelativeTime(occurredAt),
                sessionKey: run.sessionKey,
                status: run.status,
                summary: run.summary,
                trigger: run.trigger,
            };
        });
}

export function buildCronList(cronJobs: CronListOutput['jobs'], runs: CronRunsOutput['runs'] = []) {
    const runsByJobId = new Map<string, CronRunRecord[]>();

    for (const run of runs) {
        const existing = runsByJobId.get(run.jobId) ?? [];
        existing.push(run);
        runsByJobId.set(run.jobId, existing);
    }

    return cronJobs.map((job) => {
        const lastRunAt = getLastRunAt(job);

        return {
            channelId: job.agentId ?? 'agent-runtime',
            description: job.description ?? '',
            enabled: job.enabled,
            executions: buildExecutions(runsByJobId.get(job.id) ?? []),
            id: job.id,
            job,
            lastErrorMessage: formatCronErrorMessage(job.state.lastErrorMessage),
            lastErrorRaw: job.state.lastErrorMessage ?? null,
            lastRun: formatRelativeTime(lastRunAt),
            name: job.name,
            schedule: formatCronSchedule(job.schedule, true),
            successRate: getResultLabel(job),
            timeWindow: formatCronSchedule(job.schedule),
        };
    });
}

export type CronListItem = ReturnType<typeof buildCronList>[number];
