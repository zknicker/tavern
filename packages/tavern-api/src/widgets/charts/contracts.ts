import * as z from 'zod';

export const tavernRenderBarChartToolName = 'render_bar_chart' as const;
export const tavernRenderBarChartComponentId = 'tavern.render_bar_chart' as const;
export const tavernRenderLineChartToolName = 'render_line_chart' as const;
export const tavernRenderLineChartComponentId = 'tavern.render_line_chart' as const;

const chartDatumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const chartSeriesKeySchema = z.string().trim().min(1).max(80);
const numericStringPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

export const tavernRenderBarChartSeriesSchema = z
    .object({
        key: chartSeriesKeySchema,
        label: z.string().trim().min(1).max(120),
    })
    .strict();

const chartYSchema = z.union([
    chartSeriesKeySchema,
    z.array(chartSeriesKeySchema).min(1).max(4),
]);

export const tavernRenderBarChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(tavernRenderBarChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        unit: z.string().trim().min(1).max(40).optional(),
        xKey: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((props, context) => {
        validateStoredChartProps(props, context, {
            allowNegative: false,
            valueMessage: 'Bar chart series values must be finite nonnegative numbers.',
        });
    });

export const tavernRenderBarChartToolInputSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        title: z.string().trim().min(1).max(160),
        unit: z.string().trim().min(1).max(40).optional(),
        x: z.string().trim().min(1).max(80),
        y: chartYSchema,
    })
    .strict()
    .superRefine((input, context) => {
        validateToolChartInput(input, context, {
            allowNegative: false,
            valueMessage:
                'Bar chart y values must be finite nonnegative numbers or numeric strings.',
        });
    })
    .transform((input) => normalizeToolChartInput(input, { allowNegative: false }));

export const tavernRenderLineChartSeriesSchema = tavernRenderBarChartSeriesSchema;

export const tavernRenderLineChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(tavernRenderLineChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        unit: z.string().trim().min(1).max(40).optional(),
        xKey: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((props, context) => {
        validateStoredChartProps(props, context, {
            allowNegative: true,
            valueMessage: 'Line chart series values must be finite numbers.',
        });
    });

export const tavernRenderLineChartToolInputSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        title: z.string().trim().min(1).max(160),
        unit: z.string().trim().min(1).max(40).optional(),
        x: z.string().trim().min(1).max(80),
        y: chartYSchema,
    })
    .strict()
    .superRefine((input, context) => {
        validateToolChartInput(input, context, {
            allowNegative: true,
            valueMessage: 'Line chart y values must be finite numbers or numeric strings.',
        });
    })
    .transform((input) => normalizeToolChartInput(input, { allowNegative: true }));

export type TavernRenderBarChartProps = z.infer<typeof tavernRenderBarChartPropsSchema>;
export type TavernRenderBarChartToolInput = z.infer<typeof tavernRenderBarChartToolInputSchema>;
export type TavernRenderLineChartProps = z.infer<typeof tavernRenderLineChartPropsSchema>;
export type TavernRenderLineChartToolInput = z.infer<typeof tavernRenderLineChartToolInputSchema>;

interface ChartProps {
    data: Record<string, string | number | boolean | null>[];
    series: z.infer<typeof tavernRenderBarChartSeriesSchema>[];
    title: string;
    unit?: string;
    xKey: string;
}

interface ChartToolInput {
    data: Record<string, string | number | boolean | null>[];
    title: string;
    unit?: string;
    x: string;
    y: string | string[];
}

function validateStoredChartProps(
    props: ChartProps,
    context: z.RefinementCtx,
    options: { allowNegative: boolean; valueMessage: string }
) {
    const keys = new Set(props.series.map((series) => series.key));

    if (keys.size !== props.series.length) {
        context.addIssue({
            code: 'custom',
            message: 'Series keys must be unique.',
            path: ['series'],
        });
    }

    props.data.forEach((row, rowIndex) => {
        const xValue = row[props.xKey];

        if (!(typeof xValue === 'string' || typeof xValue === 'number')) {
            context.addIssue({
                code: 'custom',
                message: 'Each data row needs a string or number x value.',
                path: ['data', rowIndex, props.xKey],
            });
        }

        props.series.forEach((series, seriesIndex) => {
            const value = row[series.key];

            if (
                !(
                    typeof value === 'number' &&
                    Number.isFinite(value) &&
                    (options.allowNegative || value >= 0)
                )
            ) {
                context.addIssue({
                    code: 'custom',
                    message: options.valueMessage,
                    path: ['data', rowIndex, props.series[seriesIndex]?.key ?? series.key],
                });
            }
        });
    });
}

function validateToolChartInput(
    input: ChartToolInput,
    context: z.RefinementCtx,
    options: { allowNegative: boolean; valueMessage: string }
) {
    const yKeys = chartYKeys(input.y);
    const keys = new Set(yKeys);

    if (keys.size !== yKeys.length) {
        context.addIssue({
            code: 'custom',
            message: 'Y keys must be unique.',
            path: ['y'],
        });
    }

    input.data.forEach((row, rowIndex) => {
        const xValue = row[input.x];

        if (!(typeof xValue === 'string' || typeof xValue === 'number')) {
            context.addIssue({
                code: 'custom',
                message: 'Each data row needs a string or number x value.',
                path: ['data', rowIndex, input.x],
            });
        }

        yKeys.forEach((key) => {
            const value = chartNumberFromValue(row[key], { allowNegative: options.allowNegative });

            if (value === null) {
                context.addIssue({
                    code: 'custom',
                    message: options.valueMessage,
                    path: ['data', rowIndex, key],
                });
            }
        });
    });
}

function normalizeToolChartInput(input: ChartToolInput, options: { allowNegative: boolean }) {
    const yKeys = chartYKeys(input.y);
    const normalized = {
        data: input.data.map((row) => {
            const next = { ...row };

            for (const key of yKeys) {
                const value = chartNumberFromValue(row[key], {
                    allowNegative: options.allowNegative,
                });
                if (value !== null) {
                    next[key] = value;
                }
            }

            return next;
        }),
        series: yKeys.map((key) => ({ key, label: chartLabelFromKey(key) })),
        title: input.title,
        xKey: input.x,
    };

    return input.unit ? { ...normalized, unit: input.unit } : normalized;
}

function chartYKeys(value: string | string[]) {
    return Array.isArray(value) ? value : [value];
}

function chartLabelFromKey(key: string) {
    const words = key
        .replace(/[_-]+/gu, ' ')
        .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
        .trim();

    return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

function chartNumberFromValue(
    value: unknown,
    options: { allowNegative?: boolean } = {}
) {
    if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (options.allowNegative || value >= 0)
    ) {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    if (!numericStringPattern.test(trimmed)) {
        return null;
    }

    const numericValue = Number(trimmed);

    return Number.isFinite(numericValue) && (options.allowNegative || numericValue >= 0)
        ? numericValue
        : null;
}
