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

export function formatCronRunDeliveryLabel(status: CronRunRecord['deliveryStatus']): string {
    if (!(status && status !== 'not_applicable')) {
        return 'None';
    }
    if (status === 'parent_missing') {
        return 'Parent missing';
    }
    if (status === 'session_queued') {
        return 'Queued';
    }
    return titleCase(status);
}

export function resolveCronRunDestinationLabel(
    status: CronRunRecord['deliveryStatus'],
    deliveryDestinationLabel: string | null
): string {
    if (!(status && status !== 'not_applicable')) {
        return 'No delivery';
    }

    return deliveryDestinationLabel ?? 'Delivery target';
}

export function formatCronRunDetail(run: CronRunRecord): string | null {
    if (run.status === 'error') {
        return (
            formatCronErrorMessage(run.executionErrorMessage ?? run.deliveryError) ?? 'Run failed.'
        );
    }
    if (run.deliveryStatus === 'failed' || run.deliveryStatus === 'parent_missing') {
        return (
            formatCronErrorMessage(run.deliveryError) ??
            formatCronRunDeliveryLabel(run.deliveryStatus)
        );
    }
    return null;
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

export function getCronRunDeliveryVariant(
    status: CronRunRecord['deliveryStatus']
): BadgeProps['variant'] {
    switch (status) {
        case 'delivered':
            return 'success';
        case 'failed':
        case 'parent_missing':
            return 'destructive';
        case 'pending':
        case 'session_queued':
            return 'warning';
        default:
            return 'subtle';
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
