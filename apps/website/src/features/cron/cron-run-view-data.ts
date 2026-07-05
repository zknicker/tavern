import type { BadgeProps } from '../../components/ui/badge.tsx';
import { formatTimestamp, titleCase } from '../../lib/format.ts';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { formatCronErrorMessage } from './cron-list-data.ts';

export type CronRunRecord = CronRunsOutput['runs'][number];

export function getCronRunOccurredAt(run: CronRunRecord) {
    if (
        (run.status === 'success' || run.status === 'error' || run.status === 'skipped') &&
        run.finishedAt
    ) {
        return run.finishedAt;
    }

    return run.startedAt ?? run.scheduledFor;
}

export function formatCronRunTime(run: CronRunRecord) {
    return formatTimestamp(getCronRunOccurredAt(run));
}

export function formatCronRunFinishedLabel(run: CronRunRecord): string {
    if (run.finishedAt) {
        return formatTimestamp(run.finishedAt);
    }

    if (run.status === 'running' || run.status === 'queued') {
        return titleCase(run.status);
    }

    if (run.status === 'error') {
        return 'Failed';
    }

    return 'Completed';
}

export function formatCronRunStatus(status: CronRunRecord['status']): string {
    if (status === 'error') {
        return 'Failed';
    }
    return titleCase(status);
}

export function formatCronRunDetail(run: CronRunRecord): string | null {
    if (run.status === 'error') {
        return formatCronErrorMessage(run.executionErrorMessage) ?? 'Run failed.';
    }
    return null;
}

export function formatCronRunDuration(run: CronRunRecord): string {
    if (!(run.startedAt && run.finishedAt)) {
        return 'Not available';
    }

    const startedAt = Date.parse(run.startedAt);
    const finishedAt = Date.parse(run.finishedAt);

    if (!(Number.isFinite(startedAt) && Number.isFinite(finishedAt))) {
        return 'Not available';
    }

    const durationMs = Math.max(0, finishedAt - startedAt);

    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }

    const durationSeconds = durationMs / 1000;
    if (durationSeconds < 60) {
        return `${durationSeconds.toFixed(durationSeconds >= 10 ? 0 : 1)}s`;
    }

    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.round(durationSeconds % 60);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function getCronRunStatusVariant(status: CronRunRecord['status']): BadgeProps['variant'] {
    switch (status) {
        case 'error':
            return 'destructive';
        case 'success':
            return 'success';
        case 'queued':
        case 'running':
            return 'warning';
        default:
            return 'secondary';
    }
}

export function getCronRunStatusDotClassName(status: CronRunRecord['status']) {
    return cn(
        status === 'success' && 'bg-emerald-500',
        status === 'error' && 'bg-red-500',
        (status === 'queued' || status === 'running') && 'bg-amber-500',
        status === 'skipped' && 'bg-muted-foreground'
    );
}
