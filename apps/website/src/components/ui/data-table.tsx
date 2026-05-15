import {
    type Cell,
    flexRender,
    type Header,
    type Row,
    type RowData,
    type Table,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { ScrollArea } from './scroll-area.tsx';

export interface DataTableColumnMeta {
    align?: 'left' | 'right';
    cellClassName?: string;
    flex?: number;
    headerClassName?: string;
}

declare module '@tanstack/react-table' {
    interface ColumnMeta<TData extends RowData, TValue> extends DataTableColumnMeta {}
}

interface DataTableProps<TData extends RowData> {
    className?: string;
    edgePadding?: 'default' | 'drawer';
    rowClassName?: string | ((row: Row<TData>) => string | undefined);
    table: Table<TData>;
    virtualOverscan?: number;
    virtualRowHeight?: number;
}

export function getDataTableColumnStyle(column: {
    columnDef: { meta?: DataTableColumnMeta };
    getSize: () => number;
}) {
    if (column.columnDef.meta?.flex) {
        return {
            flex: column.columnDef.meta.flex,
            minWidth: column.getSize(),
        };
    }

    return {
        flexShrink: 0,
        width: column.getSize(),
    };
}

export function getDataTableColumnAlignClass(column: {
    columnDef: { meta?: DataTableColumnMeta };
}) {
    return column.columnDef.meta?.align === 'right' ? 'text-right' : 'text-left';
}

function getEdgePaddingClassName(index: number, total: number, edgePadding: 'default' | 'drawer') {
    if (edgePadding !== 'drawer') {
        return undefined;
    }

    return cn(index === 0 && 'ps-6', index === total - 1 && 'pe-6');
}

function getHeaderClassName<TData extends RowData>(
    header: Header<TData, unknown>,
    index: number,
    total: number,
    edgePadding: 'default' | 'drawer'
) {
    return cn(
        'whitespace-nowrap px-3 py-2 font-medium text-meta text-muted-foreground',
        getDataTableColumnAlignClass(header.column),
        getEdgePaddingClassName(index, total, edgePadding),
        header.column.columnDef.meta?.headerClassName
    );
}

export function getDataTableCellClassName<TData extends RowData>(
    cell: Cell<TData, unknown>,
    index = 0,
    total = 0,
    edgePadding: 'default' | 'drawer' = 'default'
) {
    return cn(
        'px-3',
        getDataTableColumnAlignClass(cell.column),
        getEdgePaddingClassName(index, total, edgePadding),
        cell.column.columnDef.meta?.cellClassName
    );
}

export function DataTable<TData extends RowData>({
    className,
    edgePadding = 'default',
    rowClassName,
    table,
    virtualOverscan = 20,
    virtualRowHeight,
}: DataTableProps<TData>) {
    const rows = table.getRowModel().rows;
    const headers = table.getHeaderGroups().flatMap((headerGroup) => headerGroup.headers);

    return (
        <div
            className={cn('flex flex-1 flex-col overflow-hidden', className)}
            data-slot="data-table"
        >
            <div className="border-border/50 border-b bg-muted/30" data-slot="data-table-header">
                <div className="flex w-full">
                    {headers.map((header, index) => (
                        <div
                            className={getHeaderClassName(
                                header,
                                index,
                                headers.length,
                                edgePadding
                            )}
                            key={header.id}
                            style={getDataTableColumnStyle(header.column)}
                        >
                            {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                    ))}
                </div>
            </div>

            {virtualRowHeight ? (
                <VirtualizedDataTableBody
                    edgePadding={edgePadding}
                    rowClassName={rowClassName}
                    rows={rows}
                    virtualOverscan={virtualOverscan}
                    virtualRowHeight={virtualRowHeight}
                />
            ) : (
                <DataTableBody edgePadding={edgePadding} rowClassName={rowClassName} rows={rows} />
            )}
        </div>
    );
}

function DataTableBody<TData extends RowData>({
    edgePadding,
    rowClassName,
    rows,
}: Pick<DataTableProps<TData>, 'edgePadding' | 'rowClassName'> & {
    rows: Row<TData>[];
}) {
    return (
        <ScrollArea className="min-h-0 flex-1" data-slot="data-table-body">
            {rows.map((row) => (
                <div
                    className={cn(
                        'flex min-h-11 w-full items-center border-b border-b-border/25 bg-card transition-colors hover:bg-muted/40',
                        typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
                    )}
                    key={row.id}
                >
                    {row.getVisibleCells().map((cell, index, cells) => (
                        <div
                            className={getDataTableCellClassName(
                                cell,
                                index,
                                cells.length,
                                edgePadding
                            )}
                            key={cell.id}
                            style={getDataTableColumnStyle(cell.column)}
                        >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                    ))}
                </div>
            ))}
        </ScrollArea>
    );
}

function VirtualizedDataTableBody<TData extends RowData>({
    edgePadding,
    rowClassName,
    rows,
    virtualOverscan,
    virtualRowHeight,
}: Pick<DataTableProps<TData>, 'edgePadding' | 'rowClassName'> & {
    rows: Row<TData>[];
    virtualOverscan: number;
    virtualRowHeight: number;
}) {
    const parentRef = React.useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: rows.length,
        estimateSize: () => virtualRowHeight,
        getScrollElement: () => parentRef.current,
        overscan: virtualOverscan,
    });

    return (
        <ScrollArea className="min-h-0 flex-1" data-slot="data-table-body" viewportRef={parentRef}>
            <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];

                    if (!row) {
                        return null;
                    }

                    return (
                        <div
                            className={cn(
                                'absolute left-0 flex w-full items-center border-b border-b-border/25 bg-card transition-colors hover:bg-muted/40',
                                typeof rowClassName === 'function'
                                    ? rowClassName(row)
                                    : rowClassName
                            )}
                            key={row.id}
                            style={{
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            {row.getVisibleCells().map((cell, index, cells) => (
                                <div
                                    className={getDataTableCellClassName(
                                        cell,
                                        index,
                                        cells.length,
                                        edgePadding
                                    )}
                                    key={cell.id}
                                    style={getDataTableColumnStyle(cell.column)}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
