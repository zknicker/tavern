import {
    type WidgetRenderInput,
    type WidgetTableProps,
    widgetRenderInputSchema,
} from '@tavern/api/widgets';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table.tsx';
import type { ChatLogOutput } from '../lib/trpc.tsx';
import { cn } from '../lib/utils.ts';
import { WidgetCalendarDay, WidgetCalendarEvent } from './calendar.tsx';
import { WidgetBarChart, WidgetComposedChart, WidgetLineChart } from './charts.tsx';
import { WidgetHtmlPreview } from './html-preview.tsx';
import { WidgetMerchBaseSalesChart } from './merchbase-sales-chart.tsx';

type WidgetRow = Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'widget' }>;

export function AgentWidget({ row }: { row: WidgetRow }) {
    const rendered = renderWidget(row);

    if (!rendered) {
        return (
            <WidgetFallback
                error={row.widget.validationError ?? 'Widget unavailable.'}
                text={row.widget.fallbackText}
            />
        );
    }

    return rendered;
}

function renderWidget(row: WidgetRow) {
    const widget = row.widget;

    if (widget.validationError || widget.target !== 'chat.inline') {
        return null;
    }

    const parsed = widgetRenderInputSchema.safeParse({
        component: widget.component,
        fallback: { text: widget.fallbackText },
        props: widget.props,
        target: widget.target,
    });

    if (!parsed.success) {
        return null;
    }

    // The sending agent's identity scopes workspace-backed widgets to that
    // agent's confined workspace reads.
    const agentId = row.actor?.kind === 'agent' ? row.actor.id : null;

    return (
        <div className="flex max-w-[46rem] flex-col gap-3">
            {widgetElement(parsed.data, agentId)}
        </div>
    );
}

function widgetElement(input: WidgetRenderInput, agentId: string | null) {
    switch (input.component) {
        case 'tavern.widget.table':
            return <WidgetTable props={input.props} />;
        case 'tavern.widget.bar-chart':
            return <WidgetBarChart props={input.props} />;
        case 'tavern.widget.line-chart':
            return <WidgetLineChart props={input.props} />;
        case 'tavern.widget.composed-chart':
            return <WidgetComposedChart props={input.props} />;
        case 'tavern.widget.calendar-event':
            return <WidgetCalendarEvent props={input.props} />;
        case 'tavern.widget.calendar-day':
            return <WidgetCalendarDay props={input.props} />;
        case 'tavern.widget.html-preview':
            return <WidgetHtmlPreview agentId={agentId} props={input.props} />;
        case 'tavern.widget.merchbase-sales-chart':
            return <WidgetMerchBaseSalesChart props={input.props} />;
        default:
            return null;
    }
}

function WidgetTable({ props }: { props: WidgetTableProps }) {
    return (
        <div className="max-w-[46rem] rounded-lg border border-border bg-surface-2/65">
            <Table>
                <TableHeader>
                    <TableRow>
                        {props.columns.map((column) => (
                            <TableHead
                                className={
                                    tableColumnAlign(column) === 'right' ? 'text-right' : undefined
                                }
                                key={column.key}
                            >
                                {column.label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {props.rows.map((row, index) => (
                        <TableRow key={tableRowKey(row, index)}>
                            {props.columns.map((column) => (
                                <TableCell
                                    className={cn(
                                        'max-w-[16rem] whitespace-normal break-words align-top [overflow-wrap:anywhere]',
                                        tableColumnAlign(column) === 'right'
                                            ? 'text-right tabular-nums'
                                            : null
                                    )}
                                    key={column.key}
                                >
                                    {formatTableValue(row[column.key])}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function WidgetFallback({ error, text }: { error: string | null; text: string }) {
    return (
        <div
            className={cn(
                'max-w-[42rem] rounded-md border border-border bg-surface-2/70 px-3 py-2.5',
                'text-sm leading-5'
            )}
            role="note"
        >
            <p className="whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
                {text}
            </p>
            {error ? (
                <p className="mt-1 text-muted-foreground text-xs">Widget unavailable.</p>
            ) : null}
        </div>
    );
}

function formatTableValue(value: string | number | boolean | null | undefined) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    return value;
}

function tableRowKey(row: Record<string, string | number | boolean | null>, index: number) {
    const firstValue = Object.values(row)
        .map((value) => String(value ?? ''))
        .find((value) => value.length > 0);

    return `${index}:${firstValue ?? 'row'}`;
}

function tableColumnAlign(column: WidgetTableProps['columns'][number]) {
    return 'align' in column ? column.align : undefined;
}
