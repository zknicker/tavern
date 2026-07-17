import { Table, TableBody, TableCell, TableRow } from '../../components/ui/table.tsx';
import { titleCase } from '../../lib/format.ts';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import type { CronListItem } from './cron-list-data.ts';
import {
    formatCronRunDetail,
    formatCronRunOutcome,
    formatCronRunTime,
    getCronRunDotClassName,
} from './cron-run-view-data.ts';

type CronRun = CronRunsOutput['runs'][number];

interface AutomationsRunsListProps {
    failuresOnly: boolean;
    isPending: boolean;
    jobsById: Map<string, CronListItem>;
    onRunSelect: (run: CronRun) => void;
    runs: CronRunsOutput['runs'];
}

/** Flat run history across every automation — the sidebar's Runs views. */
export function AutomationsRunsList({
    failuresOnly,
    isPending,
    jobsById,
    onRunSelect,
    runs,
}: AutomationsRunsListProps) {
    const visibleRuns = failuresOnly ? runs.filter((run) => run.status === 'error') : runs;

    if (visibleRuns.length === 0) {
        return (
            <p className="rounded-md bg-muted/35 px-2.5 py-2 text-muted-foreground text-sm">
                {isPending ? 'Loading runs...' : failuresOnly ? 'No failed runs' : 'No runs yet'}
            </p>
        );
    }

    return (
        <Table className="table-fixed">
            <colgroup>
                <col className="w-2/5" />
                <col />
                <col className="w-[6.25rem]" />
            </colgroup>
            <TableBody>
                {visibleRuns.map((run, index) => (
                    <AutomationsRunRow
                        index={index}
                        jobName={jobsById.get(run.jobId)?.name ?? 'Deleted automation'}
                        key={run.id}
                        onSelect={() => onRunSelect(run)}
                        run={run}
                    />
                ))}
            </TableBody>
        </Table>
    );
}

function AutomationsRunRow({
    index,
    jobName,
    onSelect,
    run,
}: {
    index: number;
    jobName: string;
    onSelect: () => void;
    run: CronRun;
}) {
    const detail = formatCronRunDetail(run);

    return (
        <TableRow
            aria-label={`${jobName}: ${formatCronRunOutcome(run)} ${formatCronRunTime(run)}`}
            className="cursor-pointer border-border/45 outline-hidden focus-visible:bg-hover"
            index={index}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }

                event.preventDefault();
                onSelect();
            }}
            role="button"
            tabIndex={0}
            title={detail ?? undefined}
        >
            <TableCell className="h-8 min-w-0 px-2 py-1 text-foreground">
                <span className="relative z-20 flex min-w-0 items-center gap-2">
                    <span
                        aria-hidden
                        className={cn('size-2 shrink-0 rounded-full', getCronRunDotClassName(run))}
                    />
                    <span className="min-w-0 truncate font-medium">{jobName}</span>
                </span>
            </TableCell>
            <TableCell className="h-8 min-w-0 px-2 py-1">
                <span className="relative z-20 block min-w-0 truncate">
                    {formatCronRunOutcome(run)}
                    <span className="text-muted-foreground"> · {titleCase(run.trigger)}</span>
                </span>
            </TableCell>
            <TableCell className="h-8 px-2 py-1 text-right text-muted-foreground text-xs">
                <span className="relative z-20">{formatCronRunTime(run)}</span>
            </TableCell>
        </TableRow>
    );
}
