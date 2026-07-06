import * as z from 'zod';
import {
    validateComposedStoredSeriesCount,
    validateComposedStoredSeriesKeys,
    validateStoredChartProps,
} from './chart-normalization.ts';

const chartDatumValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const chartSeriesKeySchema = z.string().trim().min(1).max(80);
const chartUnitSchema = z.string().trim().min(1).max(40);

export const widgetChartSeriesSchema = z
    .object({
        key: chartSeriesKeySchema,
        label: z.string().trim().min(1).max(120),
    })
    .strict();

export const widgetBarChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(widgetChartSeriesSchema).min(1).max(4),
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

export const widgetLineChartPropsSchema = z
    .object({
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        series: z.array(widgetChartSeriesSchema).min(1).max(4),
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

export const widgetComposedChartPropsSchema = z
    .object({
        barUnit: chartUnitSchema.optional(),
        barSeries: z.array(widgetChartSeriesSchema).min(1).max(4),
        data: z.array(z.record(z.string(), chartDatumValueSchema)).min(1).max(50),
        lineUnit: chartUnitSchema.optional(),
        lineSeries: z.array(widgetChartSeriesSchema).min(1).max(4),
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

export type WidgetBarChartProps = z.infer<typeof widgetBarChartPropsSchema>;
export type WidgetLineChartProps = z.infer<typeof widgetLineChartPropsSchema>;
export type WidgetComposedChartProps = z.infer<typeof widgetComposedChartPropsSchema>;
