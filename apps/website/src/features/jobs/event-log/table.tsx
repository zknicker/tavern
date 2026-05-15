import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { DataTable } from '../../../components/ui/data-table.tsx';
import type { JobRecentRunsOutput } from '../../../lib/trpc.tsx';
import { jobEventColumns, jobScopedEventColumns } from './columns.tsx';

interface JobsEventLogTableProps {
    className?: string;
    edgePadding?: 'default' | 'drawer';
    runs: JobRecentRunsOutput['runs'];
    showJobColumn?: boolean;
}

export function JobsEventLogTable({
    className,
    edgePadding = 'default',
    runs,
    showJobColumn = true,
}: JobsEventLogTableProps) {
    const table = useReactTable({
        columns: showJobColumn ? jobEventColumns : jobScopedEventColumns,
        data: runs,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <DataTable
            className={className}
            edgePadding={edgePadding}
            rowClassName={(row) =>
                row.original.state === 'failed' ? 'bg-destructive/[0.03]' : undefined
            }
            table={table}
            virtualOverscan={20}
            virtualRowHeight={36}
        />
    );
}
