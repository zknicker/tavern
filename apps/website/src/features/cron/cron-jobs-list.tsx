import * as React from 'react';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { cn } from '../../lib/utils.ts';
import { CronJobActions } from './cron-job-actions.tsx';
import type { CronListItem } from './cron-list-data.ts';

interface CronJobsListProps {
    activeDeleteJobId: string | null;
    activeRunJobId: string | null;
    activeToggleJobId: string | null;
    canEdit: boolean;
    jobs: CronListItem[];
    onDelete: (job: CronListItem) => Promise<void>;
    onEdit: (job: CronListItem) => void;
    onHistory: (job: CronListItem) => void;
    onRun: (job: CronListItem) => Promise<void>;
    onToggle: (job: CronListItem, enabled: boolean) => Promise<void>;
}

interface CronJobRowProps extends Omit<CronJobsListProps, 'jobs'> {
    job: CronListItem;
}

function CronJobRow({
    activeDeleteJobId,
    activeRunJobId,
    activeToggleJobId,
    canEdit,
    job,
    onDelete,
    onEdit,
    onHistory,
    onRun,
    onToggle,
}: CronJobRowProps) {
    const openJob = React.useCallback(() => onEdit(job), [job, onEdit]);
    const dotState = getCronJobDotState(job);

    return (
        <div className="group/cron-row relative flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
            <button
                aria-label={`Open ${job.name}`}
                className="no-drag absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                data-window-drag-disabled=""
                onClick={openJob}
                type="button"
            />

            <span
                aria-label={dotState.label}
                className={cn(
                    'pointer-events-none relative z-10 size-2 shrink-0 rounded-full',
                    dotState.tone === 'enabled' && 'bg-success',
                    dotState.tone === 'paused' && 'bg-muted-foreground/35',
                    dotState.tone === 'error' && 'bg-error'
                )}
                role="img"
            />

            <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col gap-1 text-left">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-medium text-[15px] text-foreground">
                        {job.name}
                    </span>
                    <span className="hidden text-muted-foreground sm:inline">·</span>
                    <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
                        {job.schedule}
                    </span>
                </div>
                {job.lastErrorMessage ? (
                    <p
                        className="max-w-[36rem] truncate text-error-foreground text-xs"
                        title={job.lastErrorRaw ?? job.lastErrorMessage}
                    >
                        {job.lastErrorMessage}
                    </p>
                ) : job.nextRun !== 'unknown' ? (
                    <p className="max-w-[36rem] truncate text-muted-foreground text-xs">
                        Next run {job.nextRun}
                    </p>
                ) : null}
            </div>

            <div className="relative z-20 ml-auto flex h-8 shrink-0 items-center justify-end">
                <CronJobActions
                    canEdit={canEdit}
                    isDeleting={activeDeleteJobId === job.id}
                    isRunning={activeRunJobId === job.id}
                    isToggling={activeToggleJobId === job.id}
                    job={job}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onHistory={onHistory}
                    onRun={onRun}
                    onToggle={onToggle}
                />
            </div>
        </div>
    );
}

function getCronJobDotState(job: CronListItem) {
    if (job.successRate === 'error') {
        return {
            label: 'Error',
            tone: 'error',
        } as const;
    }

    if (job.enabled) {
        return {
            label: 'Enabled',
            tone: 'enabled',
        } as const;
    }

    return {
        label: 'Paused',
        tone: 'paused',
    } as const;
}

export function CronJobsList({
    activeDeleteJobId,
    activeRunJobId,
    activeToggleJobId,
    canEdit,
    jobs,
    onDelete,
    onEdit,
    onHistory,
    onRun,
    onToggle,
}: CronJobsListProps) {
    return (
        <FluidList className="grid">
            {jobs.map((job, index) => (
                <FluidListItem className="-mx-3" index={index} key={job.id}>
                    <CronJobRow
                        activeDeleteJobId={activeDeleteJobId}
                        activeRunJobId={activeRunJobId}
                        activeToggleJobId={activeToggleJobId}
                        canEdit={canEdit}
                        job={job}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onHistory={onHistory}
                        onRun={onRun}
                        onToggle={onToggle}
                    />
                </FluidListItem>
            ))}
        </FluidList>
    );
}
