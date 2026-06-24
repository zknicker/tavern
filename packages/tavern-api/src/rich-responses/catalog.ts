import {
    compileSpecStream,
    defineCatalog,
    defineSchema,
    type PromptContext,
    parseSpecStreamLine,
    type SchemaType,
} from '@json-render/core';
import * as z from 'zod';
import {
    richResponseCalendarDayPropsSchema,
    richResponseCalendarEventPropsSchema,
} from './calendar/contracts.ts';
import {
    richResponseBarChartPropsSchema,
    richResponseComposedChartPropsSchema,
    richResponseLineChartPropsSchema,
} from './charts/contracts.ts';
import {
    type RichResponseSpec,
    richResponseHeadingPropsSchema,
    richResponseSeparatorPropsSchema,
    richResponseSpecSchema,
    richResponseStackPropsSchema,
    richResponseTableCanonicalPropsSchema,
    richResponseTextPropsSchema,
} from './contracts.ts';
import { richResponseMerchBaseSalesChartPropsSchema } from './merchbase/contracts.ts';

type JsonRenderZodSchema = Parameters<PromptContext['formatZodType']>[0];

const optional = <T extends SchemaType>(type: T): T & { optional: true } => ({
    ...type,
    optional: true as const,
});

const jsonRenderPropsSchema = (schema: unknown): JsonRenderZodSchema =>
    schema as JsonRenderZodSchema;

const richResponseJsonRenderSchema = defineSchema(
    (schema) => ({
        catalog: schema.object({
            components: schema.map({
                description: schema.string(),
                props: schema.zod(),
                slots: optional(schema.array(schema.string())),
            }),
        }),
        spec: schema.object({
            elements: schema.record(
                schema.object({
                    children: optional(schema.array(schema.string())),
                    on: optional(schema.record(schema.any())),
                    props: schema.propsOf('catalog.components'),
                    repeat: optional(
                        schema.object({
                            key: optional(schema.string()),
                            statePath: schema.string(),
                        })
                    ),
                    type: schema.ref('catalog.components'),
                    visible: optional(schema.any()),
                    watch: optional(schema.record(schema.any())),
                })
            ),
            root: schema.string(),
            state: optional(schema.record(schema.any())),
        }),
    }),
    {
        builtInActions: [
            {
                description:
                    'Update a value in the state model at the given statePath. Params: { statePath: string, value: any }',
                name: 'setState',
            },
            {
                description:
                    'Append an item to an array in state. Params: { statePath: string, value: any, clearStatePath?: string }. Value can contain {"$state":"/path"} refs and "$id" for auto IDs.',
                name: 'pushState',
            },
            {
                description:
                    'Remove an item from an array in state by index. Params: { statePath: string, index: number }',
                name: 'removeState',
            },
            {
                description:
                    'Validate all registered form fields and write the result to state. Params: { statePath?: string }. Defaults to /formValidation. Result: { valid: boolean, errors: Record<string, string[]> }.',
                name: 'validateForm',
            },
        ],
        defaultRules: [
            'Tavern renders Rich Responses inside chat: keep the UI compact, source-backed, and readable.',
            'Only Stack accepts children; every other component should use children: [].',
            'Use Stack as the repeat container when rendering repeated rows from state.',
            'Do not use raw HTML, JSX, CSS, class names, imports, event handlers, or tool names.',
            'Use Table for rows and columns instead of Markdown tables.',
            'Use charts for rankings, totals, trends, and comparable numeric series.',
            'Use calendar components for prepared agendas or events.',
            'Avoid repeating identical prose inside and outside a Rich Response.',
            'If the answer does not need app-rendered UI, or you are unsure the spec is valid, respond with text only.',
        ],
    }
);

export const richResponseJsonRenderCatalog = defineCatalog(richResponseJsonRenderSchema, {
    components: {
        Stack: {
            description: 'Vertical container for composing multiple child elements.',
            props: jsonRenderPropsSchema(richResponseStackPropsSchema),
            slots: ['default'],
        },
        Heading: {
            description: 'Chat-sized semibold heading text.',
            props: jsonRenderPropsSchema(richResponseHeadingPropsSchema),
        },
        Text: {
            description: 'Chat-sized paragraph text.',
            props: jsonRenderPropsSchema(richResponseTextPropsSchema),
        },
        Separator: {
            description: 'Subtle horizontal separator.',
            props: jsonRenderPropsSchema(richResponseSeparatorPropsSchema),
        },
        Table: {
            description: 'Compact rows and columns for tabular data.',
            props: jsonRenderPropsSchema(richResponseTableCanonicalPropsSchema),
        },
        BarChart: {
            description: 'Bar chart for nonnegative comparable numeric series.',
            props: jsonRenderPropsSchema(richResponseBarChartPropsSchema),
        },
        LineChart: {
            description: 'Line chart for trend series; values may be negative.',
            props: jsonRenderPropsSchema(richResponseLineChartPropsSchema),
        },
        ComposedChart: {
            description: 'Combined bar and line chart for related quantities sharing one x-axis.',
            props: jsonRenderPropsSchema(richResponseComposedChartPropsSchema),
        },
        MerchBaseSalesChart: {
            description:
                'Preferred way to present MerchBase sales trends over a date range. Fetches live MerchBase sales, renders Sales as bars and royalties as a line, includes a date range selector, and shows hover-driven sold/cancelled/returned/royalties stats for the active day. The chart fills missing days in the selected daily range as zero-sales buckets, including the current endDate. Default to the 10-day trend range for today/current sales requests; omit rangeDays or use 10 unless the user explicitly asks for a one-day chart. Use endDate to anchor the active day.',
            props: jsonRenderPropsSchema(richResponseMerchBaseSalesChartPropsSchema),
        },
        CalendarDay: {
            description: 'Single-day agenda with zero or more same-day events.',
            props: jsonRenderPropsSchema(richResponseCalendarDayPropsSchema),
        },
        CalendarEvent: {
            description: 'Single calendar event card with date, optional time, and event details.',
            props: jsonRenderPropsSchema(richResponseCalendarEventPropsSchema),
        },
    },
});

export function renderRichResponsePrompt(options?: { customRules?: string[]; system?: string }) {
    return richResponseJsonRenderCatalog.prompt({
        customRules: options?.customRules,
        mode: 'inline',
        system: options?.system,
    });
}

export function compileRichResponseSpecStream(body: string): RichResponseSpec {
    const lineCount = body
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean).length;

    if (lineCount === 0) {
        throw new Error('Rich Response spec is empty.');
    }

    if (lineCount > 300) {
        throw new Error('Rich Response specs support at most 300 patches.');
    }

    const compiled = compileSpecStream<Record<string, unknown>>(body);
    return richResponseSpecSchema.parse(compiled);
}

export function parseRichResponseSpecStreamLines(body: string) {
    const patches: unknown[] = [];

    for (const [index, line] of body.split(/\r?\n/u).entries()) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        try {
            JSON.parse(trimmed);
            patches.push(parseSpecStreamLine(trimmed));
        } catch {
            throw new Error(`Rich Response spec line ${index + 1} is not valid JSON Patch.`);
        }
    }

    return z.array(z.unknown()).parse(patches);
}
