import * as React from 'react';

import { Badge, type BadgeProps } from '../../components/ui/badge.tsx';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../components/ui/empty.tsx';
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
    sessionKey: string | null;
    startedLabel: string;
    status: CronRun['status'];
    triggerLabel: string;
}

export function CronRunsCard({ deliveryDestinationLabel, isPending, runs }: CronRunsCardProps) {
    const rows = React.useMemo(
        () => buildRows(runs, deliveryDestinationLabel),
        [deliveryDestinationLabel, runs]
    );

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
                        <span className="sr-only">Logs</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => {
                    const sessionKey = row.sessionKey;
                    return (
                        <TableRow
                            className={cn(sessionKey && 'text-foreground')}
                            key={row.id}
                            title={row.detail ?? undefined}
                        >
                            <TableCell className="pl-8">
                                <div className="relative z-20 flex min-w-0 items-center gap-2">
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
                        </TableRow>
                    );
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
        <Badge size="sm" variant={getStatusVariant(row.status)}>
            {formatRunStatus(row.status)}
        </Badge>
    );
}

function DeliveryDestination({ row }: { row: CronRunRow }) {
    if (row.deliveryStatus === 'delivered') {
        return <span className="text-foreground">{row.destinationLabel}</span>;
    }

    return (
        <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-foreground">{row.destinationLabel}</span>
            <Badge size="sm" variant={getDeliveryVariant(row.deliveryStatus)}>
                {row.deliveryLabel}
            </Badge>
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
            className={cn(
                'size-2 shrink-0 rounded-full',
                status === 'success' && 'bg-emerald-500',
                status === 'error' && 'bg-red-500',
                (status === 'queued' || status === 'running') && 'bg-amber-500'
            )}
        />
    );
}

function buildRows(
    runs: CronRunsOutput['runs'],
    deliveryDestinationLabel: string | null
): CronRunRow[] {
    return runs.map((run) => ({
        deliveryLabel: formatDeliveryLabel(run.deliveryStatus),
        deliveryStatus: run.deliveryStatus,
        destinationLabel: resolveDestinationLabel(run.deliveryStatus, deliveryDestinationLabel),
        detail: buildRunDetail(run),
        finishedLabel: formatFinishedLabel(run),
        id: run.id,
        sessionKey: run.sessionKey,
        startedLabel: formatTimestamp(run.startedAt ?? run.scheduledFor),
        status: run.status,
        triggerLabel: titleCase(run.trigger),
    }));
}

function buildRunDetail(run: CronRun): string | null {
    if (run.status === 'error') {
        return run.executionErrorMessage ?? 'Run failed.';
    }
    if (run.deliveryStatus === 'failed' || run.deliveryStatus === 'parent_missing') {
        return run.deliveryError ?? formatDeliveryLabel(run.deliveryStatus);
    }
    return null;
}

function formatFinishedLabel(run: CronRun): string {
    if (run.finishedAt) {
        return formatTimestamp(run.finishedAt);
    }

    if (run.status === 'running' || run.status === 'queued') {
        return titleCase(run.status);
    }

    if (run.status === 'error') {
        return 'Failed';
    }

    return 'Completed';
}

function formatRunStatus(status: CronRun['status']): string {
    if (status === 'error') {
        return 'Failed';
    }
    return titleCase(status);
}

function formatDeliveryLabel(status: CronRun['deliveryStatus']): string {
    if (!(status && status !== 'not_applicable')) {
        return 'None';
    }
    if (status === 'parent_missing') {
        return 'Parent missing';
    }
    if (status === 'session_queued') {
        return 'Queued';
    }
    return titleCase(status);
}

function resolveDestinationLabel(
    status: CronRun['deliveryStatus'],
    deliveryDestinationLabel: string | null
): string {
    if (!(status && status !== 'not_applicable')) {
        return 'No delivery';
    }

    return deliveryDestinationLabel ?? 'Delivery target';
}

function getStatusVariant(status: CronRun['status']): BadgeProps['variant'] {
    switch (status) {
        case 'error':
            return 'destructive';
        case 'success':
            return 'success';
        case 'queued':
        case 'running':
            return 'warning';
        default:
            return 'secondary';
    }
}

function getDeliveryVariant(status: CronRun['deliveryStatus']): BadgeProps['variant'] {
    switch (status) {
        case 'delivered':
            return 'success';
        case 'failed':
        case 'parent_missing':
            return 'destructive';
        case 'pending':
        case 'session_queued':
            return 'warning';
        default:
            return 'subtle';
    }
}
