import {
    type RichResponseElement,
    type RichResponseSpec,
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
import type { ReactNode } from 'react';
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
    if (!richResponseSpecPropsAreRenderable(spec)) {
        return null;
    }

    return (
        <div className="flex max-w-[46rem] flex-col gap-3">
            <RichResponseElementView elementId={spec.root} path={new Set()} spec={spec} />
        </div>
    );
}

function RichResponseElementView({
    elementId,
    path,
    spec,
}: {
    elementId: string;
    path: Set<string>;
    spec: RichResponseSpec;
}) {
    const element = spec.elements[elementId];

    if (!element || path.has(elementId)) {
        return null;
    }

    const childPath = new Set(path);
    childPath.add(elementId);
    const children = (element.children ?? []).map((childId) => (
        <RichResponseElementView elementId={childId} key={childId} path={childPath} spec={spec} />
    ));
    const props = resolveBindings(element.props, spec.state);

    return renderCatalogElement(element, props, children);
}

function renderCatalogElement(
    element: RichResponseElement,
    props: unknown,
    children: ReactNode[]
): ReactNode {
    switch (element.type) {
        case 'Stack': {
            const parsed = richResponseStackPropsSchema.safeParse(props);
            if (!parsed.success) {
                return null;
            }
            return (
                <div className={cn('flex min-w-0 flex-col', stackGapClass(parsed.data.gap))}>
                    {children}
                </div>
            );
        }
        case 'Heading': {
            const parsed = richResponseHeadingPropsSchema.safeParse(props);
            return parsed.success ? (
                <h3 className="min-w-0 break-words font-semibold text-foreground text-sm leading-6 [overflow-wrap:anywhere]">
                    {parsed.data.text}
                </h3>
            ) : null;
        }
        case 'Text': {
            const parsed = richResponseTextPropsSchema.safeParse(props);
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
        }
        case 'Separator': {
            const parsed = richResponseSeparatorPropsSchema.safeParse(props);
            return parsed.success ? <div className="h-px w-full bg-border/70" /> : null;
        }
        case 'Table': {
            const parsed = richResponseTablePropsSchema.safeParse(props);
            return parsed.success ? <RichResponseTable props={parsed.data} /> : null;
        }
        case 'BarChart': {
            const parsed = richResponseBarChartPropsSchema.safeParse(props);
            return parsed.success ? <RichResponseBarChart props={parsed.data} /> : null;
        }
        case 'LineChart': {
            const parsed = richResponseLineChartPropsSchema.safeParse(props);
            return parsed.success ? <RichResponseLineChart props={parsed.data} /> : null;
        }
        case 'ComposedChart': {
            const parsed = richResponseComposedChartPropsSchema.safeParse(props);
            return parsed.success ? <RichResponseComposedChart props={parsed.data} /> : null;
        }
        case 'CalendarEvent': {
            const parsed = richResponseCalendarEventPropsSchema.safeParse(props);
            return parsed.success ? <RichResponseCalendarEvent props={parsed.data} /> : null;
        }
        case 'CalendarDay': {
            const parsed = richResponseCalendarDayPropsSchema.safeParse(props);
            return parsed.success ? <RichResponseCalendarDay props={parsed.data} /> : null;
        }
        default:
            return null;
    }
}

function richResponseSpecPropsAreRenderable(spec: RichResponseSpec) {
    const visited = new Set<string>();
    const pending = [spec.root];

    while (pending.length > 0) {
        const elementId = pending.pop();
        if (!elementId || visited.has(elementId)) {
            continue;
        }

        visited.add(elementId);
        const element = spec.elements[elementId];
        if (!element) {
            return false;
        }

        const props = resolveBindings(element.props, spec.state);
        if (!catalogElementPropsAreRenderable(element, props)) {
            return false;
        }

        pending.push(...(element.children ?? []));
    }

    return true;
}

function catalogElementPropsAreRenderable(element: RichResponseElement, props: unknown) {
    switch (element.type) {
        case 'Stack':
            return richResponseStackPropsSchema.safeParse(props).success;
        case 'Heading':
            return richResponseHeadingPropsSchema.safeParse(props).success;
        case 'Text':
            return richResponseTextPropsSchema.safeParse(props).success;
        case 'Separator':
            return richResponseSeparatorPropsSchema.safeParse(props).success;
        case 'Table':
            return richResponseTablePropsSchema.safeParse(props).success;
        case 'BarChart':
            return richResponseBarChartPropsSchema.safeParse(props).success;
        case 'LineChart':
            return richResponseLineChartPropsSchema.safeParse(props).success;
        case 'ComposedChart':
            return richResponseComposedChartPropsSchema.safeParse(props).success;
        case 'CalendarEvent':
            return richResponseCalendarEventPropsSchema.safeParse(props).success;
        case 'CalendarDay':
            return richResponseCalendarDayPropsSchema.safeParse(props).success;
        default:
            return false;
    }
}

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

function resolveBindings(value: unknown, state: Record<string, unknown>): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => resolveBindings(item, state));
    }

    if (!isRecord(value)) {
        return value;
    }

    const statePath = typeof value.$state === 'string' ? value.$state : null;
    if (statePath && Object.keys(value).length === 1) {
        return readJsonPointer(state, statePath);
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, resolveBindings(item, state)])
    );
}

function readJsonPointer(source: Record<string, unknown>, path: string): unknown {
    if (path === '') {
        return source;
    }

    if (!path.startsWith('/')) {
        return undefined;
    }

    return path
        .slice(1)
        .split('/')
        .map((part) => part.replace(/~1/gu, '/').replace(/~0/gu, '~'))
        .reduce<unknown>((current, part) => {
            if (Array.isArray(current)) {
                return /^(?:0|[1-9]\d*)$/u.test(part) ? current[Number(part)] : undefined;
            }

            if (isRecord(current)) {
                return current[part];
            }

            return undefined;
        }, source);
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

type RichResponseTableProps = ReturnType<typeof richResponseTablePropsSchema.parse>;
