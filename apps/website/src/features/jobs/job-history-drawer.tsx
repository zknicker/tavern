import { AlertCircleIcon, Clock, PlayIcon } from '@hugeicons/core-free-icons';
import { HourglassIcon } from '@hugeicons-pro/core-stroke-rounded';
import {
    Drawer,
    DrawerDescription,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../components/ui/drawer.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useJobGet } from '../../hooks/jobs/use-job-get.ts';
import type { JobRecentRunsOutput, JobsListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { JobsEventLogTable } from './event-log/table.tsx';
import {
    buildJobSummaryMetaItems,
    formatNextRunShort,
    type JobSummaryMetaItem,
} from './job-summary-format.ts';

type JobSlug = JobsListOutput['jobs'][number]['slug'];

interface JobHistoryDrawerProps {
    onClose: () => void;
    selectedJobSlug: JobSlug | null;
}

export function JobHistoryDrawer({ onClose, selectedJobSlug }: JobHistoryDrawerProps) {
    const isOpen = selectedJobSlug !== null;
    const jobQuery = useJobGet(selectedJobSlug);
    const job = jobQuery.data?.job ?? null;
    const title = job?.displayName ?? 'Job history';

    const runs: JobRecentRunsOutput['runs'] =
        job?.recentRuns.map((run) => ({
            ...run,
            jobDisplayName: job.displayName,
            jobSlug: job.slug,
        })) ?? [];

    return (
        <Drawer onOpenChange={(open) => !open && onClose()} open={isOpen} position="right">
            <DrawerPopup
                className="w-[min(96vw,52rem)] max-w-[min(96vw,52rem)] overflow-hidden"
                showCloseButton
                variant="inset"
            >
                <DrawerHeader className="gap-1.5">
                    <DrawerTitle>{title}</DrawerTitle>
                    {job ? (
                        <JobHistoryDescription job={job} />
                    ) : (
                        <DrawerDescription>Loading job history...</DrawerDescription>
                    )}
                </DrawerHeader>

                <DrawerPanel className="flex min-h-0 flex-1 flex-col p-0" scrollable={false}>
                    {jobQuery.isPending ? (
                        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                            Loading history...
                        </div>
                    ) : runs.length > 0 ? (
                        <JobsEventLogTable
                            className="border-border/50 border-t"
                            edgePadding="drawer"
                            runs={runs}
                            showJobColumn={false}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                            No job executions yet.
                        </div>
                    )}
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}

function JobHistoryDescription({ job }: { job: JobsListOutput['jobs'][number] }) {
    const metaItems = buildJobSummaryMetaItems(job);
    const nextRun = formatNextRunShort(job);

    return (
        <DrawerDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {metaItems.map((item) => (
                <JobHistoryMetaItem item={item} key={`${item.kind}-${item.label}`} />
            ))}
            <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Icon
                    className="relative top-px size-3.5 text-muted-foreground/80"
                    icon={HourglassIcon}
                />
                Next run {nextRun}
            </span>
        </DrawerDescription>
    );
}

function JobHistoryMetaItem({ item }: { item: JobSummaryMetaItem }) {
    const isFailure = item.kind === 'failure';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5',
                isFailure ? 'text-destructive' : undefined
            )}
        >
            <Icon
                className={cn(
                    'relative top-px size-3.5',
                    isFailure ? 'text-destructive' : 'text-muted-foreground/80'
                )}
                icon={resolveMetaIcon(item.kind)}
            />
            {formatDrawerMetaLabel(item.label)}
        </span>
    );
}

function formatDrawerMetaLabel(label: string) {
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function resolveMetaIcon(kind: JobSummaryMetaItem['kind']) {
    switch (kind) {
        case 'failure':
        case 'availability':
            return AlertCircleIcon;
        case 'startup':
            return PlayIcon;
        case 'schedule':
            return Clock;
        default:
            return Clock;
    }
}
