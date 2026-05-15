import { CheckmarkCircle02Icon, Clock, XCircle } from '@hugeicons/core-free-icons';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { titleCase } from '../../lib/format.ts';
import type { CronListItem } from './cron-list-data.ts';

const executionStateIcons = {
    error: <Icon className="size-3.5 text-error" icon={XCircle} />,
    running: <Spinner className="size-3.5 text-warning" />,
    skipped: <Icon className="size-3.5 text-warning" icon={Clock} />,
    success: <Icon className="size-3.5 text-success" icon={CheckmarkCircle02Icon} />,
    unknown: <Icon className="size-3.5 text-muted-foreground" icon={Clock} />,
} as const;

function getJobResult(job: CronListItem) {
    const result = job.successRate;

    if (result === 'running') {
        return 'running' as const;
    }

    if (result === 'success' || result === 'error' || result === 'skipped') {
        return result;
    }

    return 'unknown' as const;
}

function successRateVariant(
    successRate: CronListItem['successRate']
): 'success' | 'destructive' | 'warning' | 'secondary' {
    switch (successRate) {
        case 'running':
        case 'skipped':
            return 'warning';
        case 'success':
            return 'success';
        case 'error':
            return 'destructive';
        default:
            return 'secondary';
    }
}

function lastExecutionState(job: CronListItem) {
    return getJobResult(job);
}

export function CronJobStateBadge({ job }: { job: CronListItem }) {
    return (
        <Badge variant={job.enabled ? 'success' : 'secondary'}>
            {job.enabled ? 'Active' : 'Paused'}
        </Badge>
    );
}

export function CronJobLastRun({ job }: { job: CronListItem }) {
    const lastExec = lastExecutionState(job);

    if (job.lastRun === 'unknown') {
        return <span className="text-muted-foreground text-sm">—</span>;
    }

    return (
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm">
            {executionStateIcons[lastExec]}
            <span>{job.lastRun}</span>
        </span>
    );
}

export function CronJobResultBadge({ job }: { job: CronListItem }) {
    if (job.successRate === 'unknown') {
        return <span className="text-muted-foreground text-sm">—</span>;
    }

    return (
        <Badge variant={successRateVariant(job.successRate)}>{titleCase(job.successRate)}</Badge>
    );
}

export function CronJobStatus({ job }: { job: CronListItem }) {
    return (
        <>
            <CronJobStateBadge job={job} />
            <span className="hidden sm:flex">
                <CronJobLastRun job={job} />
            </span>
            <CronJobResultBadge job={job} />
        </>
    );
}
