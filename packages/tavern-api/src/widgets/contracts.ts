import * as z from 'zod';
import {
    widgetCalendarDayPropsSchema,
    widgetCalendarEventPropsSchema,
} from './calendar/contracts.ts';
import {
    widgetBarChartPropsSchema,
    widgetComposedChartPropsSchema,
    widgetLineChartPropsSchema,
} from './charts/contracts.ts';
import { widgetHtmlPreviewPropsSchema } from './html-preview/contracts.ts';
import { widgetMerchBaseSalesChartPropsSchema } from './merchbase/contracts.ts';

export const widgetNameSchema = z.enum([
    'table',
    'bar-chart',
    'line-chart',
    'composed-chart',
    'calendar-event',
    'calendar-day',
    'html-preview',
    'merchbase-sales-chart',
]);

export type WidgetName = z.infer<typeof widgetNameSchema>;

export const widgetTargetSchema = z.enum(['chat.inline']);

export const widgetFallbackSchema = z
    .object({
        text: z.string().trim().min(1).max(500),
    })
    .strict();

const tableValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const widgetTableColumnSchema = z
    .object({
        align: z.enum(['left', 'right']).optional(),
        key: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120),
    })
    .strict();

export const widgetTableCanonicalPropsSchema = z
    .object({
        columns: z.array(widgetTableColumnSchema).min(1).max(8),
        rows: z.array(z.record(z.string(), tableValueSchema)).max(50),
    })
    .strict();

const widgetTableMatrixPropsSchema = z
    .object({
        columns: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
        rows: z.array(z.array(tableValueSchema).max(8)).max(50),
    })
    .strict()
    .transform((props) => {
        const columns = props.columns.map((label, index) => ({
            key: `col_${index + 1}`,
            label,
        }));

        return {
            columns,
            rows: props.rows.map((row) =>
                Object.fromEntries(columns.map((column, index) => [column.key, row[index] ?? null]))
            ),
        };
    });

export const widgetTablePropsSchema = z.union([
    widgetTableCanonicalPropsSchema,
    widgetTableMatrixPropsSchema,
]);

export const widgetPropsSchemasByName = {
    'bar-chart': widgetBarChartPropsSchema,
    'calendar-day': widgetCalendarDayPropsSchema,
    'calendar-event': widgetCalendarEventPropsSchema,
    'composed-chart': widgetComposedChartPropsSchema,
    'html-preview': widgetHtmlPreviewPropsSchema,
    'line-chart': widgetLineChartPropsSchema,
    'merchbase-sales-chart': widgetMerchBaseSalesChartPropsSchema,
    table: widgetTablePropsSchema,
} satisfies Record<WidgetName, z.ZodType>;

export function widgetComponentId<Name extends WidgetName>(name: Name): `tavern.widget.${Name}` {
    return `tavern.widget.${name}`;
}

const widgetRenderInputEntry = <Name extends WidgetName>(name: Name) =>
    z
        .object({
            component: z.literal(widgetComponentId(name)),
            fallback: widgetFallbackSchema,
            props: widgetPropsSchemasByName[name],
            target: widgetTargetSchema,
        })
        .strict();

export const widgetRenderInputSchema = z.discriminatedUnion('component', [
    widgetRenderInputEntry('table'),
    widgetRenderInputEntry('bar-chart'),
    widgetRenderInputEntry('line-chart'),
    widgetRenderInputEntry('composed-chart'),
    widgetRenderInputEntry('calendar-event'),
    widgetRenderInputEntry('calendar-day'),
    widgetRenderInputEntry('html-preview'),
    widgetRenderInputEntry('merchbase-sales-chart'),
]);

export type WidgetRenderInput = z.infer<typeof widgetRenderInputSchema>;
export type WidgetFallback = z.infer<typeof widgetFallbackSchema>;
export type WidgetTarget = z.infer<typeof widgetTargetSchema>;
export type WidgetTableProps = z.output<typeof widgetTablePropsSchema>;

export interface ParsedWidgetPayload {
    fallbackText: string;
    name: WidgetName;
    render: WidgetRenderInput;
}

/**
 * Validate one widget fence payload (already JSON-parsed) against the widget's
 * props schema and produce the durable render envelope.
 */
export function parseWidgetPayload(name: string, payload: unknown): ParsedWidgetPayload {
    const parsedName = widgetNameSchema.safeParse(name);
    if (!parsedName.success) {
        throw new Error(`Unknown widget "${name}".`);
    }

    const schema: z.ZodType = widgetPropsSchemasByName[parsedName.data];
    const props = schema.safeParse(payload);
    if (!props.success) {
        const issue = props.error.issues[0];
        const path = issue?.path.join('.') ?? '';
        throw new Error(
            `Invalid widget:${parsedName.data} props${path ? ` at ${path}` : ''}: ${issue?.message ?? 'invalid payload.'}`
        );
    }

    const fallbackText = widgetFallbackText(parsedName.data, props.data);
    const render = widgetRenderInputSchema.parse({
        component: widgetComponentId(parsedName.data),
        fallback: { text: fallbackText },
        props: props.data,
        target: 'chat.inline',
    });

    return { fallbackText, name: parsedName.data, render };
}

export function widgetFallbackText(name: WidgetName, props: unknown): string {
    const record =
        props && typeof props === 'object' && !Array.isArray(props)
            ? (props as Record<string, unknown>)
            : {};
    const title = typeof record.title === 'string' ? record.title.trim() : '';

    if (title) {
        return title.slice(0, 500);
    }

    if (name === 'table') {
        const columns = Array.isArray(record.columns) ? record.columns : [];
        const labels = columns
            .map((column) =>
                typeof column === 'string'
                    ? column
                    : ((column as { label?: unknown })?.label ?? null)
            )
            .filter((label): label is string => typeof label === 'string' && label.length > 0);
        return labels.length > 0 ? `Table: ${labels.join(', ')}`.slice(0, 500) : 'Table';
    }

    if (name === 'calendar-day') {
        const date = typeof record.date === 'string' ? record.date : null;
        return date ? `Agenda for ${date}` : 'Agenda';
    }

    if (name === 'html-preview') {
        const path = typeof record.path === 'string' ? record.path.trim() : '';
        return path ? `HTML preview: ${path}`.slice(0, 500) : 'HTML preview';
    }

    return widgetDisplayName(name);
}

export function widgetDisplayName(name: WidgetName): string {
    switch (name) {
        case 'table':
            return 'Table';
        case 'bar-chart':
            return 'Bar chart';
        case 'line-chart':
            return 'Line chart';
        case 'composed-chart':
            return 'Chart';
        case 'calendar-event':
            return 'Calendar event';
        case 'calendar-day':
            return 'Agenda';
        case 'html-preview':
            return 'HTML preview';
        case 'merchbase-sales-chart':
            return 'MerchBase sales chart';
    }
}
