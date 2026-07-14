import { formatRelativeTime, formatTimestamp } from '../../lib/format.ts';
import type { CronListOutput, CronRunsOutput } from '../../lib/trpc.tsx';

export interface CronExecution {
    chatId: string | null;
    executionErrorCode: CronRunsOutput['runs'][number]['executionErrorCode'];
    executionErrorMessage: CronRunsOutput['runs'][number]['executionErrorMessage'];
    id: string;
    occurredAt: string;
    occurredAtFormatted: string;
    occurredAtRelative: string;
    status: CronRunsOutput['runs'][number]['status'];
    trigger: CronRunsOutput['runs'][number]['trigger'];
    turnId: string | null;
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

    return job.state.lastRunStatus ?? 'unknown';
}

function getNextRunAt(job: CronJobRecord) {
    return job.state.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null;
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

function buildExecutions(runs: CronRunRecord[], now = Date.now()): CronExecution[] {
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
                chatId: run.chatId,
                executionErrorCode: run.executionErrorCode,
                executionErrorMessage: run.executionErrorMessage,
                id: run.id,
                occurredAt,
                occurredAtFormatted: formatTimestamp(occurredAt),
                occurredAtRelative: formatRelativeTime(occurredAt, now),
                status: run.status,
                trigger: run.trigger,
                turnId: run.turnId,
            };
        });
}

export function buildCronList(
    cronJobs: CronListOutput['jobs'],
    runs: CronRunsOutput['runs'] = [],
    now = Date.now()
) {
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
            executions: buildExecutions(runsByJobId.get(job.id) ?? [], now),
            id: job.id,
            isRunning: Boolean(job.state.runningAtMs),
            job,
            lastErrorMessage: formatCronErrorMessage(job.state.lastErrorMessage),
            lastErrorRaw: job.state.lastErrorMessage ?? null,
            lastRun: formatRelativeTime(lastRunAt, now),
            mode: job.mode,
            nextRun: formatTimestamp(getNextRunAt(job)),
            name: job.name,
            schedule: formatCronSchedule(job.schedule, true),
            successRate: getResultLabel(job),
            timeWindow: formatCronSchedule(job.schedule),
        };
    });
}

export type CronListItem = ReturnType<typeof buildCronList>[number];
