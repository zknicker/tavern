import { ArrowDown01Icon } from '@hugeicons-pro/core-solid-rounded';
import * as React from 'react';

import { Badge } from '../../components/ui/badge.tsx';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../components/ui/empty.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table.tsx';
import { formatTimestamp, titleCase } from '../../lib/format.ts';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { CronRunError, CronRunFacts } from './cron-run-detail-sections.tsx';
import {
    formatCronRunDeliveryLabel,
    formatCronRunDetail,
    formatCronRunFinishedLabel,
    formatCronRunStatus,
    getCronRunDeliveryVariant,
    getCronRunStatusDotClassName,
    getCronRunStatusVariant,
    resolveCronRunDestinationLabel,
} from './cron-run-view-data.ts';

interface CronRunsCardProps {
    deliveryDestinationLabel: string | null;
    isPending: boolean;
    runs: CronRunsOutput['runs'];
}

type CronRun = CronRunsOutput['runs'][number];

interface CronRunRow {
    deliveryLabel: string;
    deliveryStatus: CronRun['deliveryStatus'];
    destinationLabel: string;
    detail: string | null;
    finishedLabel: string;
    id: string;
    run: CronRun;
    sessionKey: string | null;
    startedLabel: string;
    status: CronRun['status'];
    triggerLabel: string;
}

export function CronRunsCard({ deliveryDestinationLabel, isPending, runs }: CronRunsCardProps) {
    const [expandedRunId, setExpandedRunId] = React.useState<string | null>(null);
    const rows = React.useMemo(
        () => buildRows(runs, deliveryDestinationLabel),
        [deliveryDestinationLabel, runs]
    );

    React.useEffect(() => {
        if (expandedRunId && !rows.some((row) => row.id === expandedRunId)) {
            setExpandedRunId(null);
        }
    }, [expandedRunId, rows]);

    if (rows.length === 0) {
        return <CronRunsEmpty isPending={isPending} />;
    }

    return (
        <Table className="table-fixed">
            <colgroup>
                <col className="w-[23%]" />
                <col className="w-[23%]" />
                <col className="w-[23%]" />
                <col className="hidden w-[17%] sm:table-column" />
                <col className="w-[31%] sm:w-[14%]" />
            </colgroup>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-8">Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="hidden sm:table-cell">Trigger</TableHead>
                    <TableHead className="pr-8 text-right">
                        <span className="sr-only">Session</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.flatMap((row, index) => {
                    const sessionKey = row.sessionKey;
                    const expanded = expandedRunId === row.id;
                    const toggleExpanded = () => {
                        setExpandedRunId(expanded ? null : row.id);
                    };

                    return [
                        <TableRow
                            aria-expanded={expanded}
                            className={cn(
                                'cursor-pointer outline-hidden focus-visible:bg-hover',
                                sessionKey && 'text-foreground'
                            )}
                            index={index}
                            key={row.id}
                            onClick={toggleExpanded}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') {
                                    return;
                                }

                                event.preventDefault();
                                toggleExpanded();
                            }}
                            role="button"
                            tabIndex={0}
                            title={row.detail ?? undefined}
                        >
                            <TableCell className="pl-8">
                                <div className="relative z-20 flex min-w-0 items-center gap-2">
                                    <Icon
                                        aria-hidden
                                        className={cn(
                                            'size-3.5 shrink-0 text-muted-foreground transition-transform',
                                            expanded && 'rotate-180'
                                        )}
                                        icon={ArrowDown01Icon}
                                    />
                                    <StatusDot status={row.status} />
                                    <span className="truncate font-medium">{row.startedLabel}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="relative z-20">
                                    <RunOutcome row={row} />
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="relative z-20">
                                    <DeliveryDestination row={row} />
                                </div>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                                <span className="relative z-20">{row.triggerLabel}</span>
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                                {sessionKey ? (
                                    <span className="relative z-20 font-mono text-muted-foreground text-xs">
                                        {sessionKey}
                                    </span>
                                ) : (
                                    <span className="relative z-20 text-muted-foreground">-</span>
                                )}
                            </TableCell>
                        </TableRow>,
                        expanded ? (
                            <tr
                                className="border-border/60 border-b bg-muted/25"
                                key={`${row.id}:details`}
                            >
                                <td className="px-8 pt-1 pb-4" colSpan={5}>
                                    <div className="grid gap-3 rounded-lg border border-border/70 bg-background/80 p-3">
                                        <CronRunFacts
                                            deliveryDestinationLabel={deliveryDestinationLabel}
                                            run={row.run}
                                            variant="bare"
                                        />
                                        <CronRunError run={row.run} />
                                    </div>
                                </td>
                            </tr>
                        ) : null,
                    ];
                })}
            </TableBody>
        </Table>
    );
}

function RunOutcome({ row }: { row: CronRunRow }) {
    if (row.status === 'success') {
        return <span className="text-foreground">{row.finishedLabel}</span>;
    }

    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <Badge size="sm" variant={getCronRunStatusVariant(row.status)}>
                {formatCronRunStatus(row.status)}
            </Badge>
            {row.detail ? (
                <span
                    className="max-w-full truncate text-muted-foreground text-xs"
                    title={row.detail}
                >
                    {row.detail}
                </span>
            ) : null}
        </div>
    );
}

function DeliveryDestination({ row }: { row: CronRunRow }) {
    if (row.deliveryStatus === 'delivered') {
        return <span className="text-foreground">{row.destinationLabel}</span>;
    }

    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-foreground">{row.destinationLabel}</span>
                <Badge size="sm" variant={getCronRunDeliveryVariant(row.deliveryStatus)}>
                    {row.deliveryLabel}
                </Badge>
            </div>
            {row.detail &&
            (row.deliveryStatus === 'failed' || row.deliveryStatus === 'parent_missing') ? (
                <span
                    className="max-w-full truncate text-muted-foreground text-xs"
                    title={row.detail}
                >
                    {row.detail}
                </span>
            ) : null}
        </div>
    );
}

function CronRunsEmpty({ isPending }: { isPending: boolean }) {
    return (
        <div className="flex min-h-[18rem] items-center justify-center">
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{isPending ? 'Loading runs' : 'No runs yet'}</EmptyTitle>
                    <EmptyDescription>
                        {isPending
                            ? 'Fetching recent automation runs.'
                            : 'Runs will appear after the automation fires.'}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    );
}

function StatusDot({ status }: { status: CronRun['status'] }) {
    return (
        <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full', getCronRunStatusDotClassName(status))}
        />
    );
}

function buildRows(
    runs: CronRunsOutput['runs'],
    deliveryDestinationLabel: string | null
): CronRunRow[] {
    return runs.map((run) => ({
        deliveryLabel: formatCronRunDeliveryLabel(run.deliveryStatus),
        deliveryStatus: run.deliveryStatus,
        destinationLabel: resolveCronRunDestinationLabel(
            run.deliveryStatus,
            deliveryDestinationLabel
        ),
        detail: formatCronRunDetail(run),
        finishedLabel: formatCronRunFinishedLabel(run),
        id: run.id,
        run,
        sessionKey: run.sessionKey,
        startedLabel: formatTimestamp(run.startedAt ?? run.scheduledFor),
        status: run.status,
        triggerLabel: titleCase(run.trigger),
    }));
}
