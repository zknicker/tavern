import type { ColumnDef } from '@tanstack/react-table';
import type { DataTableColumnMeta } from '../../../components/ui/data-table.tsx';
import type { JobRecentRunsOutput } from '../../../lib/trpc.tsx';
import {
    JobEventDurationCell,
    JobEventErrorCell,
    JobEventNameCell,
    JobEventStatusCell,
    JobEventTimeCell,
} from './cells.tsx';

export type RunEvent = JobRecentRunsOutput['runs'][number];

const timeColumn: ColumnDef<RunEvent> = {
    accessorKey: 'createdAt',
    header: 'Time',
    size: 128,
    cell: JobEventTimeCell,
};

const jobColumn: ColumnDef<RunEvent> = {
    accessorKey: 'jobDisplayName',
    header: 'Job',
    meta: { flex: 1 } satisfies DataTableColumnMeta,
    size: 180,
    cell: JobEventNameCell,
};

const statusColumn: ColumnDef<RunEvent> = {
    accessorKey: 'state',
    header: 'Status',
    size: 104,
    cell: JobEventStatusCell,
};

const errorColumn: ColumnDef<RunEvent> = {
    accessorKey: 'error',
    header: 'Message',
    meta: { flex: 2 } satisfies DataTableColumnMeta,
    size: 200,
    cell: JobEventErrorCell,
};

const durationColumn: ColumnDef<RunEvent> = {
    accessorKey: 'durationMs',
    header: 'Duration',
    meta: { align: 'right' } satisfies DataTableColumnMeta,
    size: 80,
    cell: JobEventDurationCell,
};

export const jobEventColumns: ColumnDef<RunEvent>[] = [
    timeColumn,
    jobColumn,
    statusColumn,
    errorColumn,
    durationColumn,
];

export const jobScopedEventColumns: ColumnDef<RunEvent>[] = [
    timeColumn,
    statusColumn,
    errorColumn,
    durationColumn,
];
