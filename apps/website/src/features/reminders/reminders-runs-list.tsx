import { Table, TableBody, TableCell, TableRow } from '../../components/ui/table.tsx';
import type { ReminderRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import type { ReminderListItem } from './reminder-list-data.ts';
import {
    formatReminderRunDetail,
    formatReminderRunOutcome,
    formatReminderRunTime,
    getReminderRunDotClassName,
} from './reminder-run-view-data.ts';

type ReminderRun = ReminderRunsOutput['runs'][number];

interface RemindersRunsListProps {
    failuresOnly: boolean;
    isPending: boolean;
    onRunSelect: (run: ReminderRun) => void;
    remindersById: Map<string, ReminderListItem>;
    runs: ReminderRunsOutput['runs'];
}

/** Flat run history across every reminder — the sidebar's Runs views. Ported
    from automations-runs-list.tsx. */
export function RemindersRunsList({
    failuresOnly,
    isPending,
    onRunSelect,
    remindersById,
    runs,
}: RemindersRunsListProps) {
    const visibleRuns = failuresOnly ? runs.filter((run) => run.outcome === 'error') : runs;

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
                    <ReminderRunRow
                        index={index}
                        key={run.id}
                        onSelect={() => onRunSelect(run)}
                        reminderName={remindersById.get(run.reminderId)?.name ?? 'Deleted reminder'}
                        run={run}
                    />
                ))}
            </TableBody>
        </Table>
    );
}

function ReminderRunRow({
    index,
    onSelect,
    reminderName,
    run,
}: {
    index: number;
    onSelect: () => void;
    reminderName: string;
    run: ReminderRun;
}) {
    const detail = formatReminderRunDetail(run);

    return (
        <TableRow
            aria-label={`${reminderName}: ${formatReminderRunOutcome(run)} ${formatReminderRunTime(run)}`}
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
                        className={cn(
                            'size-2 shrink-0 rounded-full',
                            getReminderRunDotClassName(run)
                        )}
                    />
                    <span className="min-w-0 truncate font-medium">{reminderName}</span>
                </span>
            </TableCell>
            <TableCell className="h-8 min-w-0 px-2 py-1">
                <span className="relative z-20 block min-w-0 truncate">
                    {formatReminderRunOutcome(run)}
                    {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
                </span>
            </TableCell>
            <TableCell className="h-8 px-2 py-1 text-right text-muted-foreground text-xs">
                <span className="relative z-20">{formatReminderRunTime(run)}</span>
            </TableCell>
        </TableRow>
    );
}
