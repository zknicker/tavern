import {
    Drawer,
    DrawerDescription,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../../components/ui/drawer.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useMemoryJobDetail } from '../../../hooks/memory/use-memory-history.ts';
import { formatTimestamp } from '../../../lib/format.ts';
import { cn } from '../../../lib/utils.ts';
import {
    activityName,
    formatDuration,
    type MemoryRunReportView,
    runStatusDotClassName,
    runStatusLabel,
} from './background-work-view-data.ts';
import { MemoryRunReportContent } from './memory-run-report-sections.tsx';

export function MemoryRunReportDrawer({
    jobId,
    onClose,
}: {
    jobId: string | null;
    onClose: () => void;
}) {
    return (
        <Drawer onOpenChange={(open) => !open && onClose()} open={jobId !== null} position="right">
            {jobId ? (
                <DrawerPopup
                    className="w-[min(96vw,32rem)] max-w-[min(96vw,32rem)]"
                    showCloseButton
                    variant="inset"
                >
                    <DrawerBody jobId={jobId} />
                </DrawerPopup>
            ) : null}
        </Drawer>
    );
}

function DrawerBody({ jobId }: { jobId: string }) {
    const jobQuery = useMemoryJobDetail(jobId);

    if (jobQuery.isPending) {
        return (
            <>
                <DrawerHeader className="gap-1 pe-28">
                    <DrawerTitle className="text-lg">Run details</DrawerTitle>
                </DrawerHeader>
                <DrawerPanel>
                    <Skeleton className="h-40 rounded-md" />
                </DrawerPanel>
            </>
        );
    }
    if (jobQuery.error || !jobQuery.data) {
        return (
            <>
                <DrawerHeader className="gap-1 pe-28">
                    <DrawerTitle className="text-lg">Run details</DrawerTitle>
                </DrawerHeader>
                <DrawerPanel>
                    <p className="text-destructive text-sm">
                        {jobQuery.error?.message ?? 'This run is no longer available.'}
                    </p>
                </DrawerPanel>
            </>
        );
    }

    const job = jobQuery.data as MemoryRunReportView;

    return (
        <>
            <DrawerHeader className="gap-1 pe-28">
                <DrawerTitle className="text-lg">{activityName(job.kind)}</DrawerTitle>
                <DrawerDescription className="truncate text-sm">
                    {formatTimestamp(job.completedAt ?? job.createdAt)}
                </DrawerDescription>
            </DrawerHeader>
            <DrawerPanel className="space-y-4">
                <ReportHeader job={job} />
                <MemoryRunReportContent job={job} />
            </DrawerPanel>
        </>
    );
}

function ReportHeader({ job }: { job: MemoryRunReportView }) {
    const duration = formatDuration(durationOf(job));
    const modelLabel = job.model ? `${job.model.provider}/${job.model.model}` : null;

    return (
        <section className="space-y-2.5">
            <div className="flex min-w-0 items-center gap-2 text-sm">
                <span
                    aria-hidden
                    className={cn(
                        'size-2 shrink-0 rounded-full',
                        runStatusDotClassName(job.status)
                    )}
                />
                <p className="font-medium text-foreground">{runStatusLabel(job.status)}</p>
                {duration ? (
                    <>
                        <span aria-hidden className="shrink-0 text-muted-foreground/60">
                            ·
                        </span>
                        <p className="shrink-0 font-mono text-muted-foreground tabular-nums">
                            {duration}
                        </p>
                    </>
                ) : null}
                {modelLabel ? (
                    <>
                        <span aria-hidden className="shrink-0 text-muted-foreground/60">
                            ·
                        </span>
                        <p className="min-w-0 truncate font-mono text-muted-foreground">
                            {modelLabel}
                        </p>
                    </>
                ) : null}
            </div>
            {job.status === 'failed' && job.error ? (
                <div className="rounded-md border border-error/30 bg-error-bg/70 px-3 py-2.5">
                    <p className="text-pretty text-error-foreground/85 text-sm leading-5">
                        {job.error}
                    </p>
                </div>
            ) : null}
        </section>
    );
}

function durationOf(job: MemoryRunReportView): number | null {
    if (!(job.completedAt && job.createdAt)) {
        return null;
    }
    const started = Date.parse(job.createdAt);
    const completed = Date.parse(job.completedAt);
    if (!(Number.isFinite(started) && Number.isFinite(completed))) {
        return null;
    }
    return Math.max(0, completed - started);
}
