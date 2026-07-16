import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    Table as TableRoot,
    TableRow,
} from '../components/ui/table.tsx';
import { cn } from '../lib/utils.ts';

export type TableValue = string | number | boolean | null;

export interface TableColumn {
    align?: 'left' | 'right';
    key: string;
    label: string;
}

export function Table({
    columns,
    rows,
}: {
    columns: TableColumn[];
    rows: Record<string, TableValue>[];
}) {
    return (
        <div className="max-w-[46rem] rounded-lg border border-border bg-surface-2/65">
            <TableRoot>
                <TableHeader>
                    <TableRow>
                        {columns.map((column) => (
                            <TableHead
                                className={column.align === 'right' ? 'text-right' : undefined}
                                key={column.key}
                            >
                                {column.label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, index) => (
                        <TableRow key={tableRowKey(row, index)}>
                            {columns.map((column) => (
                                <TableCell
                                    className={cn(
                                        'max-w-[16rem] whitespace-normal break-words align-top [overflow-wrap:anywhere]',
                                        column.align === 'right' ? 'text-right tabular-nums' : null
                                    )}
                                    key={column.key}
                                >
                                    {formatTableValue(row[column.key])}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </TableRoot>
        </div>
    );
}

function formatTableValue(value: TableValue | undefined) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    return value;
}

function tableRowKey(row: Record<string, TableValue>, index: number) {
    const firstValue = Object.values(row)
        .map((value) => String(value ?? ''))
        .find((value) => value.length > 0);

    return `${index}:${firstValue ?? 'row'}`;
}
