import * as z from 'zod';
import {
    validateComposedStoredSeriesCount,
    validateComposedStoredSeriesKeys,
    validateStoredChartProps,
} from './chart-normalization.ts';

export const richResponseBarChartComponentType = 'BarChart' as const;
export const richResponseLineChartComponentType = 'LineChart' as const;
export const richResponseComposedChartComponentType = 'ComposedChart' as const;

const chartDatumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const chartSeriesKeySchema = z.string().trim().min(1).max(80);
const chartUnitSchema = z.string().trim().min(1).max(40);

export const richResponseChartSeriesSchema = z
    .object({
        key: chartSeriesKeySchema,
        label: z.string().trim().min(1).max(120),
    })
    .strict();

export const richResponseBarChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(richResponseChartSeriesSchema).min(1).max(4),
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

export const richResponseLineChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(richResponseChartSeriesSchema).min(1).max(4),
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

export const richResponseComposedChartPropsSchema = z
    .object({
        barUnit: chartUnitSchema.optional(),
        barSeries: z.array(richResponseChartSeriesSchema).min(1).max(4),
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        lineUnit: chartUnitSchema.optional(),
        lineSeries: z.array(richResponseChartSeriesSchema).min(1).max(4),
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

export type RichResponseBarChartProps = z.infer<typeof richResponseBarChartPropsSchema>;
export type RichResponseLineChartProps = z.infer<typeof richResponseLineChartPropsSchema>;
export type RichResponseComposedChartProps = z.infer<typeof richResponseComposedChartPropsSchema>;
