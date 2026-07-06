import { describe, expect, test } from 'bun:test';
import { widgetComponentId, widgetRenderInputSchema } from '../contracts.ts';
import {
    widgetBarChartPropsSchema,
    widgetComposedChartPropsSchema,
    widgetLineChartPropsSchema,
} from './contracts.ts';

describe('Widget chart contracts', () => {
    test('render input accepts bar chart props', () => {
        const props = widgetBarChartPropsSchema.parse({
            data: [{ quarter: 'Q1', revenue: 12_000 }],
            series: [{ key: 'revenue', label: 'Revenue' }],
            title: 'Quarterly Revenue',
            unit: 'USD',
            xKey: 'quarter',
        });

        const result = widgetRenderInputSchema.safeParse({
            component: widgetComponentId('bar-chart'),
            fallback: { text: props.title },
            props,
            target: 'chat.inline',
        });

        expect(result.success).toBe(true);
    });

    test('line chart values may be negative', () => {
        const result = widgetLineChartPropsSchema.safeParse({
            data: [{ day: 'Mon', delta: -4 }],
            series: [{ key: 'delta', label: 'Delta' }],
            title: 'Daily Delta',
            xKey: 'day',
        });

        expect(result.success).toBe(true);
    });

    test('composed chart rejects duplicated series keys', () => {
        const result = widgetComposedChartPropsSchema.safeParse({
            barSeries: [{ key: 'sales', label: 'Sales' }],
            data: [{ month: 'Jan', sales: 10 }],
            lineSeries: [{ key: 'sales', label: 'Sales' }],
            title: 'Sales',
            xKey: 'month',
        });

        expect(result.success).toBe(false);
    });
});
