import * as z from 'zod';

export const tavernRenderBarChartToolName = 'render_bar_chart' as const;
export const tavernRenderBarChartComponentId = 'tavern.render_bar_chart' as const;
export const tavernRenderLineChartToolName = 'render_line_chart' as const;
export const tavernRenderLineChartComponentId = 'tavern.render_line_chart' as const;

const chartDatumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const numericStringPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

export const tavernRenderBarChartSeriesSchema = z
    .object({
        key: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120),
    })
    .strict();

export const tavernRenderBarChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(tavernRenderBarChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        xKey: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((props, context) => {
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

                if (!(typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
                    context.addIssue({
                        code: 'custom',
                        message: 'Bar chart series values must be finite nonnegative numbers.',
                        path: ['data', rowIndex, props.series[seriesIndex]?.key ?? series.key],
                    });
                }
            });
        });
    });

export const tavernRenderBarChartToolInputSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(tavernRenderBarChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        xKey: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((props, context) => {
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
                const value = chartNumberFromValue(row[series.key]);

                if (value === null) {
                    context.addIssue({
                        code: 'custom',
                        message:
                            'Bar chart series values must be finite nonnegative numbers or numeric strings.',
                        path: ['data', rowIndex, props.series[seriesIndex]?.key ?? series.key],
                    });
                }
            });
        });
    })
    .transform((props) => ({
        ...props,
        data: props.data.map((row) => {
            const normalized = { ...row };

            for (const series of props.series) {
                const value = chartNumberFromValue(row[series.key]);
                if (value !== null) {
                    normalized[series.key] = value;
                }
            }

            return normalized;
        }),
    }));

export const tavernRenderLineChartSeriesSchema = tavernRenderBarChartSeriesSchema;

export const tavernRenderLineChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(tavernRenderLineChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        xKey: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((props, context) => {
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

                if (!(typeof value === 'number' && Number.isFinite(value))) {
                    context.addIssue({
                        code: 'custom',
                        message: 'Line chart series values must be finite numbers.',
                        path: ['data', rowIndex, props.series[seriesIndex]?.key ?? series.key],
                    });
                }
            });
        });
    });

export const tavernRenderLineChartToolInputSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(tavernRenderLineChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        xKey: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((props, context) => {
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
                const value = chartNumberFromValue(row[series.key], { allowNegative: true });

                if (value === null) {
                    context.addIssue({
                        code: 'custom',
                        message: 'Line chart series values must be finite numbers or numeric strings.',
                        path: ['data', rowIndex, props.series[seriesIndex]?.key ?? series.key],
                    });
                }
            });
        });
    })
    .transform((props) => ({
        ...props,
        data: props.data.map((row) => {
            const normalized = { ...row };

            for (const series of props.series) {
                const value = chartNumberFromValue(row[series.key], { allowNegative: true });
                if (value !== null) {
                    normalized[series.key] = value;
                }
            }

            return normalized;
        }),
    }));

export type TavernRenderBarChartProps = z.infer<typeof tavernRenderBarChartPropsSchema>;
export type TavernRenderBarChartToolInput = z.infer<typeof tavernRenderBarChartToolInputSchema>;
export type TavernRenderLineChartProps = z.infer<typeof tavernRenderLineChartPropsSchema>;
export type TavernRenderLineChartToolInput = z.infer<typeof tavernRenderLineChartToolInputSchema>;

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
