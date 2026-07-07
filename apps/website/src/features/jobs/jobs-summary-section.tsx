import * as React from 'react';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SettingsGroup, SettingsSection } from '../../components/ui/settings-row.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.tsx';
import { formatTimestamp } from '../../lib/format.ts';
import type { JobsListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { buildJobSummaryMetaParts, formatNextRunShort } from './job-summary-format.ts';

type JobSummary = JobsListOutput['jobs'][number];

interface JobsSummarySectionProps {
    jobs: JobsListOutput['jobs'];
    onSelectJob: (slug: JobSummary['slug']) => void;
}

export function JobsSummarySection({ jobs, onSelectJob }: JobsSummarySectionProps) {
    return (
        <SettingsSection title="Operational Jobs">
            <SettingsGroup>
                {jobs.map((job, index) => (
                    <React.Fragment key={job.slug}>
                        {index > 0 ? <Separator /> : null}
                        <JobSummaryRow job={job} onSelectJob={onSelectJob} />
                    </React.Fragment>
                ))}
            </SettingsGroup>
        </SettingsSection>
    );
}

function JobSummaryRow({
    job,
    onSelectJob,
}: {
    job: JobSummary;
    onSelectJob: (slug: JobSummary['slug']) => void;
}) {
    const isDisabled = job.availability === 'disabled';
    const dotClass = resolveDotClass(job);
    const metaParts = buildJobSummaryMetaParts(job);

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <button
                        className={cn(
                            'flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-accent/40',
                            isDisabled ? 'opacity-60' : undefined
                        )}
                        onClick={() => onSelectJob(job.slug)}
                        type="button"
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-2 shrink-0 rounded-full ring-2 ring-background',
                                dotClass
                            )}
                        />

                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground text-sm">
                                {job.displayName}
                            </p>
                            <p
                                className={cn(
                                    'truncate text-meta text-muted-foreground',
                                    job.counts.failed > 0
                                        ? '[&>span:last-child]:text-destructive'
                                        : undefined
                                )}
                            >
                                {metaParts.map((part, index) => (
                                    <React.Fragment key={part}>
                                        {index > 0 ? <span className="mx-1.5">·</span> : null}
                                        <span>{part}</span>
                                    </React.Fragment>
                                ))}
                            </p>
                        </div>

                        <p className="shrink-0 text-meta text-muted-foreground tabular-nums">
                            {formatNextRunShort(job)}
                        </p>
                    </button>
                }
            />
            <TooltipContent className="max-w-xs">
                <JobDotTooltipBody job={job} />
            </TooltipContent>
        </Tooltip>
    );
}

function JobDotTooltipBody({ job }: { job: JobSummary }) {
    return (
        <div className="space-y-2 py-0.5">
            <div className="space-y-0.5">
                <div className="font-medium text-foreground capitalize">
                    {resolveHealthLabel(job)}
                </div>
                {job.disabledReason ? (
                    <div className="text-destructive text-meta">{job.disabledReason}</div>
                ) : null}
                {job.latestRun?.createdAt ? (
                    <div className="text-muted-foreground tabular-nums">
                        Latest run <RelativeTime value={job.latestRun.createdAt} /> ·{' '}
                        {formatTimestamp(job.latestRun.createdAt)}
                    </div>
                ) : (
                    <div className="text-muted-foreground">No runs recorded yet.</div>
                )}
            </div>

            <div className="text-meta text-muted-foreground/80 tabular-nums">
                {job.counts.completed} completed · {job.counts.failed} failed ·{' '}
                {job.counts.active + job.counts.waiting + job.counts.delayed} pending
            </div>

            {job.description ? (
                <p className="text-meta text-muted-foreground leading-5">{job.description}</p>
            ) : null}
        </div>
    );
}

function resolveDotClass(job: JobSummary): string {
    if (job.availability === 'disabled') {
        return 'bg-muted-foreground/40';
    }

    const state = job.latestRun?.state;

    switch (state) {
        case 'completed':
            return 'bg-success';
        case 'failed':
            return 'bg-destructive';
        case 'active':
        case 'waiting':
            return 'bg-warning';
        case 'delayed':
            return 'bg-warning';
        default:
            return 'bg-success/70';
    }
}

function resolveHealthLabel(job: JobSummary): string {
    if (job.availability === 'disabled') {
        return 'Disabled';
    }

    const state = job.latestRun?.state;

    switch (state) {
        case 'completed':
            return 'Healthy';
        case 'failed':
            return 'Last run failed';
        case 'active':
            return 'Running now';
        case 'waiting':
            return 'Waiting';
        case 'delayed':
            return 'Delayed';
        default:
            return 'Idle';
    }
}
