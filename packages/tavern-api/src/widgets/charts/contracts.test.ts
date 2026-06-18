import { expect, test } from 'bun:test';
import { widgetRenderInputSchema } from '../contracts.ts';
import {
    tavernRenderBarChartComponentId,
    tavernRenderBarChartPropsSchema,
    tavernRenderBarChartToolInputSchema,
    tavernRenderLineChartComponentId,
    tavernRenderLineChartPropsSchema,
    tavernRenderLineChartToolInputSchema,
} from './contracts.ts';

test('widget render input accepts the chart widget demo payload', () => {
    const result = widgetRenderInputSchema.safeParse({
        component: tavernRenderBarChartComponentId,
        fallback: { text: 'Quarterly Revenue' },
        target: 'chat.inline',
        props: {
            data: [
                { quarter: 'Q1', revenue: 12_000 },
                { quarter: 'Q2', revenue: 15_500 },
            ],
            series: [{ key: 'revenue', label: 'Revenue' }],
            title: 'Quarterly Revenue',
            xKey: 'quarter',
        },
    });

    expect(result.success).toBe(true);
});

test('widget render input rejects model-authored widget ids', () => {
    const result = widgetRenderInputSchema.safeParse({
        component: tavernRenderBarChartComponentId,
        fallback: { text: 'Quarterly Revenue' },
        id: 'model-owned-id',
        props: {
            data: [{ quarter: 'Q1', revenue: 12_000 }],
            series: [{ key: 'revenue', label: 'Revenue' }],
            title: 'Quarterly Revenue',
            xKey: 'quarter',
        },
        target: 'chat.inline',
    });

    expect(result.success).toBe(false);
});

test('chart bar props reject missing numeric series values', () => {
    const result = tavernRenderBarChartPropsSchema.safeParse({
        data: [{ quarter: 'Q1', revenue: '12000' }],
        series: [{ key: 'revenue', label: 'Revenue' }],
        title: 'Quarterly Revenue',
        xKey: 'quarter',
    });

    expect(result.success).toBe(false);
});

test('chart bar tool input normalizes numeric string series values', () => {
    const result = tavernRenderBarChartToolInputSchema.safeParse({
        data: [{ quarter: 'Q1', revenue: '12000' }],
        series: [{ key: 'revenue', label: 'Revenue' }],
        title: 'Quarterly Revenue',
        xKey: 'quarter',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
        throw new Error('Expected chart tool input to parse.');
    }
    expect(result.data.data).toEqual([{ quarter: 'Q1', revenue: 12_000 }]);
});

test('chart bar tool input rejects nonnumeric string series values', () => {
    const result = tavernRenderBarChartToolInputSchema.safeParse({
        data: [{ quarter: 'Q1', revenue: 'twelve thousand' }],
        series: [{ key: 'revenue', label: 'Revenue' }],
        title: 'Quarterly Revenue',
        xKey: 'quarter',
    });

    expect(result.success).toBe(false);
});

test('widget render input accepts the line chart widget demo payload', () => {
    const result = widgetRenderInputSchema.safeParse({
        component: tavernRenderLineChartComponentId,
        fallback: { text: 'Monthly Signups' },
        target: 'chat.inline',
        props: {
            data: [
                { month: 'Jan', signups: 180, churn: -12 },
                { month: 'Feb', signups: 220, churn: -9 },
            ],
            series: [
                { key: 'signups', label: 'Signups' },
                { key: 'churn', label: 'Churn' },
            ],
            title: 'Monthly Signups',
            xKey: 'month',
        },
    });

    expect(result.success).toBe(true);
});

test('chart line props accept finite negative series values', () => {
    const result = tavernRenderLineChartPropsSchema.safeParse({
        data: [{ month: 'Jan', net: -12 }],
        series: [{ key: 'net', label: 'Net' }],
        title: 'Net Change',
        xKey: 'month',
    });

    expect(result.success).toBe(true);
});

test('chart line tool input normalizes negative numeric string series values', () => {
    const result = tavernRenderLineChartToolInputSchema.safeParse({
        data: [{ month: 'Jan', net: '-12.5' }],
        series: [{ key: 'net', label: 'Net' }],
        title: 'Net Change',
        xKey: 'month',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
        throw new Error('Expected line chart tool input to parse.');
    }
    expect(result.data.data).toEqual([{ month: 'Jan', net: -12.5 }]);
});
