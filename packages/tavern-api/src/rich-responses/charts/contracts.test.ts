import { describe, expect, test } from 'bun:test';
import { richResponseComponentId, richResponseRenderInputSchema } from '../contracts.ts';
import {
    richResponseBarChartPropsSchema,
    richResponseComposedChartPropsSchema,
    richResponseLineChartPropsSchema,
} from './contracts.ts';

describe('Rich Response chart contracts', () => {
    test('render input accepts a bar chart spec', () => {
        const props = richResponseBarChartPropsSchema.parse({
            data: [{ quarter: 'Q1', revenue: 12_000 }],
            series: [{ key: 'revenue', label: 'Revenue' }],
            title: 'Quarterly Revenue',
            unit: 'USD',
            xKey: 'quarter',
        });

        const result = richResponseRenderInputSchema.safeParse({
            component: richResponseComponentId,
            fallback: { text: props.title },
            props: {
                spec: {
                    elements: {
                        chart: { props, type: 'BarChart' },
                    },
                    root: 'chart',
                    state: {},
                },
            },
            target: 'chat.inline',
        });

        expect(result.success).toBe(true);
    });

    test('line chart values may be negative', () => {
        const result = richResponseLineChartPropsSchema.safeParse({
            data: [{ day: 'Mon', delta: -4 }],
            series: [{ key: 'delta', label: 'Delta' }],
            title: 'Daily Delta',
            xKey: 'day',
        });

        expect(result.success).toBe(true);
    });

    test('composed chart rejects duplicated series keys', () => {
        const result = richResponseComposedChartPropsSchema.safeParse({
            barSeries: [{ key: 'sales', label: 'Sales' }],
            data: [{ month: 'Jan', sales: 10 }],
            lineSeries: [{ key: 'sales', label: 'Sales' }],
            title: 'Sales',
            xKey: 'month',
        });

        expect(result.success).toBe(false);
    });
});
