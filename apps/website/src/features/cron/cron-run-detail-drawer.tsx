import {
    Drawer,
    DrawerDescription,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../components/ui/drawer.tsx';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { CronRunFacts } from './cron-run-detail-sections.tsx';
import {
    formatCronRunDetail,
    formatCronRunFinishedLabel,
    formatCronRunStatus,
    formatCronRunTime,
    getCronRunStatusDotClassName,
} from './cron-run-view-data.ts';

type CronRun = CronRunsOutput['runs'][number];

interface CronRunDetailDrawerProps {
    deliveryDestinationLabel: string | null;
    jobName: string | null;
    onClose: () => void;
    run: CronRun | null;
}

export function CronRunDetailDrawer({
    deliveryDestinationLabel,
    jobName,
    onClose,
    run,
}: CronRunDetailDrawerProps) {
    return (
        <Drawer onOpenChange={(open) => !open && onClose()} open={run !== null} position="right">
            {run ? (
                <DrawerPopup
                    className="w-[min(96vw,32rem)] max-w-[min(96vw,32rem)]"
                    showCloseButton
                    variant="inset"
                >
                    <DrawerHeader className="gap-1 pe-28">
                        <DrawerTitle className="text-lg">Run details</DrawerTitle>
                        <DrawerDescription className="truncate text-sm">
                            {jobName ?? 'Automation run'}
                        </DrawerDescription>
                    </DrawerHeader>
                    <DrawerPanel className="space-y-4">
                        <RunOutcome run={run} />
                        <CronRunFacts
                            deliveryDestinationLabel={deliveryDestinationLabel}
                            run={run}
                        />
                    </DrawerPanel>
                </DrawerPopup>
            ) : null}
        </Drawer>
    );
}

function RunOutcome({ run }: { run: CronRun }) {
    const detail = formatCronRunDetail(run);
    const output = detail
        ? { body: detail, tone: 'error' as const, title: 'Error' }
        : {
              body: run.summary ?? getMissingSummaryMessage(run),
              tone: run.summary ? ('default' as const) : ('muted' as const),
              title: 'Output preview',
          };

    return (
        <section className="space-y-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
                <span
                    aria-hidden
                    className={cn(
                        'size-2 shrink-0 rounded-full',
                        getCronRunStatusDotClassName(run.status)
                    )}
                />
                <p className="truncate font-medium text-foreground">
                    {formatCronRunStatus(run.status)}
                </p>
                <span aria-hidden className="shrink-0 text-muted-foreground/60">
                    ·
                </span>
                <p className="min-w-0 truncate font-mono text-muted-foreground tabular-nums">
                    {formatCronRunTime(run)}
                </p>
            </div>
            <RunOutcomeMessage body={output.body} title={output.title} tone={output.tone} />
        </section>
    );
}

function RunOutcomeMessage({
    body,
    title,
    tone,
}: {
    body: string;
    title: string;
    tone: 'default' | 'error' | 'muted';
}) {
    return (
        <div
            className={cn(
                'rounded-md border px-3 py-2.5',
                tone === 'error' ? 'border-error/30 bg-error-bg/70' : 'border-border/60 bg-muted/10'
            )}
        >
            <p
                className={cn(
                    'font-medium text-sm',
                    tone === 'error' ? 'text-error-foreground' : 'text-foreground'
                )}
            >
                {title}
            </p>
            <p
                className={cn(
                    'mt-1 max-w-[44ch] text-pretty text-sm leading-5',
                    tone === 'error'
                        ? 'text-error-foreground/85'
                        : tone === 'muted'
                          ? 'text-muted-foreground/72'
                          : 'text-muted-foreground'
                )}
            >
                {body}
            </p>
        </div>
    );
}

function getMissingSummaryMessage(run: CronRun) {
    if (run.status === 'queued' || run.status === 'running') {
        return 'No output summary recorded yet.';
    }

    return `${formatCronRunFinishedLabel(run)}, but no output summary was recorded.`;
}
