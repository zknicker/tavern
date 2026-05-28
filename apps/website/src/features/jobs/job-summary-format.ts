import type { JobsListOutput } from '../../lib/trpc.tsx';

type JobSummary = JobsListOutput['jobs'][number];

export type JobSummaryMetaKind = 'availability' | 'failure' | 'schedule' | 'startup';

export interface JobSummaryMetaItem {
    kind: JobSummaryMetaKind;
    label: string;
}

export function buildJobSummaryMetaItems(job: JobSummary): JobSummaryMetaItem[] {
    const metaItems: JobSummaryMetaItem[] = [];

    if (job.availability === 'disabled') {
        metaItems.push({ kind: 'availability', label: 'Disabled' });
        if (job.disabledReason) {
            metaItems.push({ kind: 'availability', label: job.disabledReason });
        }
        return metaItems;
    }

    metaItems.push({ kind: 'schedule', label: formatSchedulePhrase(job.schedule) });

    if (job.schedule.kind === 'interval' && job.schedule.runOnStart) {
        metaItems.push({ kind: 'startup', label: 'runs on startup' });
    }

    if (job.counts.failed > 0) {
        metaItems.push({ kind: 'failure', label: `${job.counts.failed} failed` });
    }

    return metaItems;
}

export function buildJobSummaryMetaParts(job: JobSummary): string[] {
    return buildJobSummaryMetaItems(job).map((item) => item.label);
}

export function formatNextRunShort(job: JobSummary): string {
    if (job.availability === 'disabled') {
        return '—';
    }

    if (job.schedule.kind === 'manual') {
        return 'manual';
    }

    if (!job.schedule.nextRunAt) {
        return 'scheduling...';
    }

    return formatUpcomingTime(job.schedule.nextRunAt);
}

function formatSchedulePhrase(schedule: JobSummary['schedule']): string {
    if (schedule.kind === 'manual') {
        return 'manual';
    }

    return `every ${formatCadence(schedule.everyMs)}`;
}

function formatCadence(everyMs: number): string {
    if (everyMs < 60_000) {
        return `${Math.round(everyMs / 1000)}s`;
    }

    if (everyMs < 60 * 60_000) {
        return `${Math.round(everyMs / 60_000)}m`;
    }

    if (everyMs < 24 * 60 * 60_000) {
        const hours = everyMs / (60 * 60_000);
        return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
    }

    const days = everyMs / (24 * 60 * 60_000);
    return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

function formatUpcomingTime(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

    if (diffMinutes < 2) {
        return 'now';
    }

    if (diffMinutes < 60) {
        return `in ${diffMinutes}m`;
    }

    const diffHours = Math.round(diffMinutes / 60);

    if (diffHours < 24) {
        return `in ${diffHours}h`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `in ${diffDays}d`;
}
