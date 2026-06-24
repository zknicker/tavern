import { type ComponentRenderer, JSONUIProvider, Renderer, type Spec } from '@json-render/react';
import {
    richResponseHeadingPropsSchema,
    richResponseRenderInputSchema,
    richResponseSeparatorPropsSchema,
    richResponseStackPropsSchema,
    richResponseTablePropsSchema,
    richResponseTextPropsSchema,
} from '@tavern/api/rich-responses';
import {
    richResponseCalendarDayPropsSchema,
    richResponseCalendarEventPropsSchema,
} from '@tavern/api/rich-responses/calendar';
import {
    richResponseBarChartPropsSchema,
    richResponseComposedChartPropsSchema,
    richResponseLineChartPropsSchema,
} from '@tavern/api/rich-responses/charts';
import { richResponseMerchBaseSalesChartPropsSchema } from '@tavern/api/rich-responses/merchbase';
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
import { RichResponseCalendarDay, RichResponseCalendarEvent } from './calendar.tsx';
import {
    RichResponseBarChart,
    RichResponseComposedChart,
    RichResponseLineChart,
} from './charts.tsx';
import { RichResponseMerchBaseSalesChart } from './merchbase-sales-chart.tsx';

type RichResponseRow = Extract<
    NonNullable<ChatLogOutput>['rows'][number],
    { kind: 'rich_response' }
>;

export function AgentRichResponse({ row }: { row: RichResponseRow }) {
    const rendered = renderRichResponse(row.richResponse);

    if (!rendered) {
        return (
            <RichResponseFallback
                error={row.richResponse.validationError ?? 'Rich Response unavailable.'}
                text={row.richResponse.fallbackText}
            />
        );
    }

    return rendered;
}

function renderRichResponse(richResponse: RichResponseRow['richResponse']) {
    if (richResponse.validationError || richResponse.target !== 'chat.inline') {
        return null;
    }

    const parsed = richResponseRenderInputSchema.safeParse({
        component: richResponse.component,
        fallback: { text: richResponse.fallbackText },
        props: richResponse.props,
        target: richResponse.target,
    });

    if (!parsed.success) {
        return null;
    }

    const spec = parsed.data.props.spec;
    return (
        <JSONUIProvider initialState={spec.state} registry={richResponseRegistry}>
            <div className="flex max-w-[46rem] flex-col gap-3">
                <Renderer
                    fallback={RichResponseUnknownElement}
                    registry={richResponseRegistry}
                    spec={spec as Spec}
                />
            </div>
        </JSONUIProvider>
    );
}

const richResponseRegistry: Record<string, ComponentRenderer> = {
    BarChart: ({ element }) => {
        const parsed = richResponseBarChartPropsSchema.safeParse(element.props);
        return parsed.success ? <RichResponseBarChart props={parsed.data} /> : null;
    },
    CalendarDay: ({ element }) => {
        const parsed = richResponseCalendarDayPropsSchema.safeParse(element.props);
        return parsed.success ? <RichResponseCalendarDay props={parsed.data} /> : null;
    },
    CalendarEvent: ({ element }) => {
        const parsed = richResponseCalendarEventPropsSchema.safeParse(element.props);
        return parsed.success ? <RichResponseCalendarEvent props={parsed.data} /> : null;
    },
    ComposedChart: ({ element }) => {
        const parsed = richResponseComposedChartPropsSchema.safeParse(element.props);
        return parsed.success ? <RichResponseComposedChart props={parsed.data} /> : null;
    },
    Heading: ({ element }) => {
        const parsed = richResponseHeadingPropsSchema.safeParse(element.props);
        return parsed.success ? (
            <h3 className="min-w-0 break-words font-semibold text-foreground text-sm leading-6 [overflow-wrap:anywhere]">
                {parsed.data.text}
            </h3>
        ) : null;
    },
    LineChart: ({ element }) => {
        const parsed = richResponseLineChartPropsSchema.safeParse(element.props);
        return parsed.success ? <RichResponseLineChart props={parsed.data} /> : null;
    },
    MerchBaseSalesChart: ({ element }) => {
        const parsed = richResponseMerchBaseSalesChartPropsSchema.safeParse(element.props);
        return parsed.success ? (
            <RichResponseMerchBaseSalesChart props={parsed.data} />
        ) : (
            <RichResponseFallback error={parsed.error.message} text="MerchBase sales chart." />
        );
    },
    Separator: ({ element }) => {
        const parsed = richResponseSeparatorPropsSchema.safeParse(element.props);
        return parsed.success ? <div className="h-px w-full bg-border/70" /> : null;
    },
    Stack: ({ children, element }) => {
        const parsed = richResponseStackPropsSchema.safeParse(element.props);
        if (!parsed.success) {
            return null;
        }

        return (
            <div className={cn('flex min-w-0 flex-col', stackGapClass(parsed.data.gap))}>
                {children}
            </div>
        );
    },
    Table: ({ element }) => {
        const parsed = richResponseTablePropsSchema.safeParse(element.props);
        return parsed.success ? <RichResponseTable props={parsed.data} /> : null;
    },
    Text: ({ element }) => {
        const parsed = richResponseTextPropsSchema.safeParse(element.props);
        return parsed.success ? (
            <p
                className={cn(
                    'min-w-0 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]',
                    parsed.data.muted ? 'text-muted-foreground' : 'text-foreground'
                )}
            >
                {parsed.data.text}
            </p>
        ) : null;
    },
};

const RichResponseUnknownElement: ComponentRenderer = () => null;

function RichResponseTable({ props }: { props: RichResponseTableProps }) {
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

function RichResponseFallback({ error, text }: { error: string | null; text: string }) {
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
                <p className="mt-1 text-muted-foreground text-xs">Rich Response unavailable.</p>
            ) : null}
        </div>
    );
}

function stackGapClass(gap: 'lg' | 'md' | 'sm' | undefined) {
    switch (gap) {
        case 'sm':
            return 'gap-2';
        case 'lg':
            return 'gap-4';
        default:
            return 'gap-3';
    }
}

function formatTableValue(value: string | number | boolean | null) {
    if (value === null) {
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

function tableColumnAlign(column: RichResponseTableProps['columns'][number]) {
    return 'align' in column ? column.align : undefined;
}

type RichResponseTableProps = ReturnType<typeof richResponseTablePropsSchema.parse>;
