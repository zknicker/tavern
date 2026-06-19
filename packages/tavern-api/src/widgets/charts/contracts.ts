import * as z from 'zod';
import {
    normalizeToolChartInput,
    normalizeToolComposedChartInput,
    validateComposedStoredSeriesCount,
    validateComposedStoredSeriesKeys,
    validateStoredChartProps,
    validateToolChartInput,
    validateToolComposedChartInput,
} from './chart-normalization.ts';

export const tavernRenderBarChartToolName = 'render_bar_chart' as const;
export const tavernRenderBarChartComponentId = 'tavern.render_bar_chart' as const;
export const tavernRenderLineChartToolName = 'render_line_chart' as const;
export const tavernRenderLineChartComponentId = 'tavern.render_line_chart' as const;
export const tavernRenderComposedChartToolName = 'render_composed_chart' as const;
export const tavernRenderComposedChartComponentId = 'tavern.render_composed_chart' as const;

const chartDatumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const chartSeriesKeySchema = z.string().trim().min(1).max(80);
const chartUnitSchema = z.string().trim().min(1).max(40);

export const tavernRenderBarChartSeriesSchema = z
    .object({
        key: chartSeriesKeySchema,
        label: z.string().trim().min(1).max(120),
    })
    .strict();

const chartYSchema = z.union([chartSeriesKeySchema, z.array(chartSeriesKeySchema).min(1).max(4)]);

export const tavernRenderBarChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(tavernRenderBarChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        unit: chartUnitSchema.optional(),
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
        unit: chartUnitSchema.optional(),
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
        unit: chartUnitSchema.optional(),
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
        unit: chartUnitSchema.optional(),
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

export const tavernRenderComposedChartSeriesSchema = tavernRenderBarChartSeriesSchema;

export const tavernRenderComposedChartPropsSchema = z
    .object({
        barUnit: chartUnitSchema.optional(),
        barSeries: z.array(tavernRenderComposedChartSeriesSchema).min(1).max(4),
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        lineUnit: chartUnitSchema.optional(),
        lineSeries: z.array(tavernRenderComposedChartSeriesSchema).min(1).max(4),
        title: z.string().trim().min(1).max(160),
        unit: chartUnitSchema.optional(),
        xKey: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((props, context) => {
        validateStoredChartProps({ ...props, series: props.barSeries }, context, {
            allowNegative: false,
            valueMessage: 'Composed chart bar values must be finite nonnegative numbers.',
        });
        validateStoredChartProps({ ...props, series: props.lineSeries }, context, {
            allowNegative: true,
            valueMessage: 'Composed chart line values must be finite numbers.',
        });
        validateComposedStoredSeriesCount(props, context);
        validateComposedStoredSeriesKeys(props, context);
    });

export const tavernRenderComposedChartToolInputSchema = z
    .object({
        barUnit: chartUnitSchema.optional(),
        barY: chartYSchema,
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        lineUnit: chartUnitSchema.optional(),
        lineY: chartYSchema,
        title: z.string().trim().min(1).max(160),
        unit: chartUnitSchema.optional(),
        x: z.string().trim().min(1).max(80),
    })
    .strict()
    .superRefine((input, context) => {
        validateToolComposedChartInput(input, context);
    })
    .transform(normalizeToolComposedChartInput);

export type TavernRenderBarChartProps = z.infer<typeof tavernRenderBarChartPropsSchema>;
export type TavernRenderBarChartToolInput = z.infer<typeof tavernRenderBarChartToolInputSchema>;
export type TavernRenderLineChartProps = z.infer<typeof tavernRenderLineChartPropsSchema>;
export type TavernRenderLineChartToolInput = z.infer<typeof tavernRenderLineChartToolInputSchema>;
export type TavernRenderComposedChartProps = z.infer<typeof tavernRenderComposedChartPropsSchema>;
export type TavernRenderComposedChartToolInput = z.infer<
    typeof tavernRenderComposedChartToolInputSchema
>;
