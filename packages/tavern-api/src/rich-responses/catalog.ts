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

type JsonRenderZodSchema = Parameters<PromptContext['formatZodType']>[0];

interface RichResponseJsonRenderCatalogInput {
    components: Record<
        string,
        {
            description: string;
            props: JsonRenderZodSchema;
        }
    >;
}

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
            }),
        }),
        spec: schema.object({
            elements: schema.record(
                schema.object({
                    children: optional(schema.array(schema.string())),
                    props: schema.propsOf('catalog.components'),
                    type: schema.ref('catalog.components'),
                })
            ),
            root: schema.string(),
            state: optional(schema.record(schema.any())),
        }),
    }),
    {
        promptTemplate: ({ catalog, componentNames, formatZodType, options }) => {
            const richCatalog = catalog as RichResponseJsonRenderCatalogInput;
            const system =
                typeof options.system === 'string'
                    ? options.system
                    : 'Use Rich Responses for app-rendered UI in final replies.';
            const customRules = Array.isArray(options.customRules) ? options.customRules : [];
            const lines = [
                system,
                '',
                'OUTPUT FORMAT (text + JSONL, RFC 6902 JSON Patch):',
                'Write normal prose before or after a Rich Response. Put the Rich Response spec in exactly one ```spec code fence.',
                'Each non-empty line inside the fence is one JSON Patch operation. Start with /root, then add /elements/<id> objects.',
                '',
                'The spec shape is:',
                '- root: string element id',
                '- elements: object keyed by element id',
                '- each element: { "type": <component>, "props": <component props>, "children": [] }',
                '',
                'Available components:',
            ];

            for (const name of componentNames) {
                const definition = richCatalog.components[name];
                if (!definition) {
                    continue;
                }

                lines.push(`- ${name}: ${definition.description}`);
                lines.push(`  props: ${formatZodType(definition.props)}`);
            }

            lines.push(
                '',
                'Rules:',
                '- Use only the available components and their listed prop keys.',
                '- Do not use raw HTML, JSX, CSS, class names, imports, event handlers, or tool names.',
                '- Use Table for rows and columns instead of Markdown tables.',
                '- Use charts for rankings, totals, trends, and comparable numeric series.',
                '- Use calendar components for prepared agendas or events.',
                '- If the answer does not need app-rendered UI, respond with text only.'
            );

            lines.push(...customRules.map((rule) => `- ${rule}`));
            return lines.join('\n');
        },
    }
);

export const richResponseJsonRenderCatalog = defineCatalog(richResponseJsonRenderSchema, {
    components: {
        BarChart: {
            description: 'Bar chart for nonnegative comparable numeric series.',
            props: jsonRenderPropsSchema(richResponseBarChartPropsSchema),
        },
        CalendarDay: {
            description: 'Single-day agenda with zero or more same-day events.',
            props: jsonRenderPropsSchema(richResponseCalendarDayPropsSchema),
        },
        CalendarEvent: {
            description: 'Single calendar event card with date, optional time, and event details.',
            props: jsonRenderPropsSchema(richResponseCalendarEventPropsSchema),
        },
        ComposedChart: {
            description: 'Combined bar and line chart for related quantities sharing one x-axis.',
            props: jsonRenderPropsSchema(richResponseComposedChartPropsSchema),
        },
        Heading: {
            description: 'Chat-sized semibold heading text.',
            props: jsonRenderPropsSchema(richResponseHeadingPropsSchema),
        },
        LineChart: {
            description: 'Line chart for trend series; values may be negative.',
            props: jsonRenderPropsSchema(richResponseLineChartPropsSchema),
        },
        Separator: {
            description: 'Subtle horizontal separator.',
            props: jsonRenderPropsSchema(richResponseSeparatorPropsSchema),
        },
        Stack: {
            description: 'Vertical container for composing multiple child elements.',
            props: jsonRenderPropsSchema(richResponseStackPropsSchema),
        },
        Table: {
            description: 'Compact rows and columns for tabular data.',
            props: jsonRenderPropsSchema(richResponseTableCanonicalPropsSchema),
        },
        Text: {
            description: 'Chat-sized paragraph text.',
            props: jsonRenderPropsSchema(richResponseTextPropsSchema),
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
