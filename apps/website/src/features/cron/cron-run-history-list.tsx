import { Table, TableBody, TableCell, TableRow } from '../../components/ui/table.tsx';
import { titleCase } from '../../lib/format.ts';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    formatCronRunDetail,
    formatCronRunOutcome,
    formatCronRunTime,
    getCronRunDotClassName,
} from './cron-run-view-data.ts';

type CronRun = CronRunsOutput['runs'][number];

interface CronRunHistoryListProps {
    isPending: boolean;
    onRunSelect: (run: CronRun) => void;
    runs: CronRunsOutput['runs'];
}

export function CronRunHistoryList({ isPending, onRunSelect, runs }: CronRunHistoryListProps) {
    const visibleRuns = runs.slice(0, 10);

    if (visibleRuns.length === 0) {
        return (
            <p className="rounded-md bg-muted/35 px-2.5 py-2 text-muted-foreground text-sm">
                {isPending ? 'Loading runs...' : 'No runs yet'}
            </p>
        );
    }

    return (
        <Table className="table-fixed">
            <colgroup>
                <col />
                <col className="w-[6.25rem]" />
            </colgroup>
            <TableBody>
                {visibleRuns.map((run, index) => (
                    <RunHistoryRow
                        index={index}
                        key={run.id}
                        onSelect={() => onRunSelect(run)}
                        run={run}
                    />
                ))}
            </TableBody>
        </Table>
    );
}

function RunHistoryRow({
    index,
    onSelect,
    run,
}: {
    index: number;
    onSelect: () => void;
    run: CronRun;
}) {
    const detail = formatCronRunDetail(run);

    return (
        <TableRow
            aria-label={`${formatCronRunOutcome(run)} ${titleCase(run.trigger)} ${formatCronRunTime(run)}`}
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
                    <span className="min-w-0 truncate">
                        <span className="font-medium">{formatCronRunOutcome(run)}</span>
                        <span className="text-muted-foreground"> · {titleCase(run.trigger)}</span>
                    </span>
                </span>
            </TableCell>
            <TableCell className="h-8 px-2 py-1 text-right text-muted-foreground text-xs">
                <span className="relative z-20">{formatCronRunTime(run)}</span>
            </TableCell>
        </TableRow>
    );
}
