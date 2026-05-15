import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import * as React from 'react';
import { Badge, type BadgeProps } from '../../components/ui/badge.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Card } from '../../components/ui/card.tsx';
import { DataTable, type DataTableColumnMeta } from '../../components/ui/data-table.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useSessionDrawer } from '../../hooks/sessions/use-session-drawer.ts';
import { formatTimestamp, titleCase } from '../../lib/format.ts';
import type { CronRunsOutput } from '../../lib/trpc.tsx';

interface CronRunsCardProps {
    isPending: boolean;
    runs: CronRunsOutput['runs'];
}

interface CronRunRow {
    deliveryLabel: string;
    deliveryStatus: CronRunsOutput['runs'][number]['deliveryStatus'];
    detail: string | null;
    durationLabel: string;
    id: string;
    scheduledForLabel: string;
    sessionKey: string | null;
    startedAtLabel: string | null;
    status: CronRunsOutput['runs'][number]['status'];
    triggerLabel: string;
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
    if (!(startedAt && finishedAt)) {
        return '—';
    }

    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

    if (!Number.isFinite(durationMs) || durationMs < 0) {
        return '—';
    }

    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }

    if (durationMs < 60_000) {
        return `${(durationMs / 1000).toFixed(1)}s`;
    }

    return `${(durationMs / 60_000).toFixed(1)}m`;
}

function getStatusVariant(status: CronRunRow['status']): BadgeProps['variant'] {
    switch (status) {
        case 'success':
            return 'success';
        case 'error':
            return 'destructive';
        case 'running':
        case 'queued':
        case 'skipped':
            return 'warning';
        default:
            return 'secondary';
    }
}

function getDeliveryVariant(status: CronRunRow['deliveryStatus']): BadgeProps['variant'] {
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
            return 'secondary';
    }
}

function buildRows(runs: CronRunsOutput['runs']): CronRunRow[] {
    return runs.slice(0, 20).map((run) => ({
        deliveryLabel: titleCase(run.deliveryStatus ?? 'not_applicable'),
        deliveryStatus: run.deliveryStatus,
        detail: run.executionErrorMessage ?? run.deliveryError ?? run.summary,
        durationLabel: formatDuration(run.startedAt, run.finishedAt),
        id: run.id,
        scheduledForLabel: formatTimestamp(run.scheduledFor),
        sessionKey: run.sessionKey,
        startedAtLabel: run.startedAt ? formatTimestamp(run.startedAt) : null,
        status: run.status,
        triggerLabel: titleCase(run.trigger),
    }));
}

export function CronRunsCard({ isPending, runs }: CronRunsCardProps) {
    const { openSession } = useSessionDrawer();
    const rows = React.useMemo(() => buildRows(runs), [runs]);
    const columns = React.useMemo<ColumnDef<CronRunRow>[]>(
        () => [
            {
                accessorKey: 'status',
                header: 'Status',
                size: 110,
                cell: ({ row }) => (
                    <Badge variant={getStatusVariant(row.original.status)}>
                        {titleCase(row.original.status)}
                    </Badge>
                ),
            },
            {
                accessorKey: 'scheduledForLabel',
                header: 'Time',
                meta: { flex: 1 } satisfies DataTableColumnMeta,
                size: 180,
                cell: ({ row }) => (
                    <div className="py-3">
                        <p className="text-foreground text-sm">{row.original.scheduledForLabel}</p>
                        <p className="text-muted-foreground text-xs">
                            {row.original.startedAtLabel
                                ? `Started ${row.original.startedAtLabel}`
                                : 'Waiting to start'}
                        </p>
                    </div>
                ),
            },
            {
                accessorKey: 'triggerLabel',
                header: 'Trigger',
                meta: {
                    cellClassName: 'hidden md:block',
                    headerClassName: 'hidden md:block',
                } satisfies DataTableColumnMeta,
                size: 100,
                cell: ({ row }) => (
                    <span className="text-muted-foreground text-sm">
                        {row.original.triggerLabel}
                    </span>
                ),
            },
            {
                accessorKey: 'deliveryLabel',
                header: 'Delivery',
                meta: {
                    cellClassName: 'hidden lg:block',
                    headerClassName: 'hidden lg:block',
                } satisfies DataTableColumnMeta,
                size: 130,
                cell: ({ row }) => (
                    <Badge variant={getDeliveryVariant(row.original.deliveryStatus)}>
                        {row.original.deliveryLabel}
                    </Badge>
                ),
            },
            {
                accessorKey: 'detail',
                header: 'Summary',
                meta: { flex: 1 } satisfies DataTableColumnMeta,
                size: 220,
                cell: ({ row }) =>
                    row.original.detail ? (
                        <span
                            className="line-clamp-1 text-foreground/80 text-sm"
                            title={row.original.detail}
                        >
                            {row.original.detail}
                        </span>
                    ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                    ),
            },
            {
                accessorKey: 'durationLabel',
                header: 'Duration',
                meta: {
                    align: 'right',
                    cellClassName: 'hidden md:block',
                    headerClassName: 'hidden md:block',
                } satisfies DataTableColumnMeta,
                size: 90,
                cell: ({ row }) => (
                    <span className="text-muted-foreground text-sm tabular-nums">
                        {row.original.durationLabel}
                    </span>
                ),
            },
            {
                id: 'session',
                header: '',
                meta: { align: 'right' } satisfies DataTableColumnMeta,
                size: 110,
                cell: ({ row }) =>
                    row.original.sessionKey ? (
                        <Button
                            onClick={() => openSession(row.original.sessionKey as string)}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            Open Session
                        </Button>
                    ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                    ),
            },
        ],
        [openSession]
    );
    const table = useReactTable({
        columns,
        data: rows,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <Card className="min-h-[18rem] overflow-hidden">
            <BadgeDivider
                className="px-4 pt-5 pb-4"
                subtext="The latest queued, running, and completed runs for this automation."
            >
                Recent Runs
            </BadgeDivider>
            {rows.length > 0 ? (
                <DataTable
                    rowClassName={(row) =>
                        row.original.status === 'error' ? 'bg-destructive/[0.03]' : undefined
                    }
                    table={table}
                />
            ) : (
                <div className="px-4 pb-5 text-muted-foreground text-sm">
                    {isPending ? 'Loading recent runs...' : 'This automation has not run yet.'}
                </div>
            )}
        </Card>
    );
}
