import { expect, test } from 'bun:test';
import { widgetRenderInputSchema } from '../contracts.ts';
import {
    tavernRenderBarChartComponentId,
    tavernRenderBarChartPropsSchema,
    tavernRenderBarChartToolInputSchema,
    tavernRenderComposedChartComponentId,
    tavernRenderComposedChartPropsSchema,
    tavernRenderComposedChartToolInputSchema,
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
        title: 'Quarterly Revenue',
        unit: 'USD',
        x: 'quarter',
        y: 'revenue',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
        throw new Error('Expected chart tool input to parse.');
    }
    expect(result.data).toEqual({
        data: [{ quarter: 'Q1', revenue: 12_000 }],
        series: [{ key: 'revenue', label: 'Revenue' }],
        title: 'Quarterly Revenue',
        unit: 'USD',
        xKey: 'quarter',
    });
});

test('chart bar tool input accepts multiple y keys', () => {
    const result = tavernRenderBarChartToolInputSchema.safeParse({
        data: [{ quarter: 'Q1', revenue: '12000', expenses: 7600 }],
        title: 'Quarterly Revenue',
        x: 'quarter',
        y: ['revenue', 'expenses'],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
        throw new Error('Expected chart tool input to parse.');
    }
    expect(result.data.series).toEqual([
        { key: 'revenue', label: 'Revenue' },
        { key: 'expenses', label: 'Expenses' },
    ]);
});

test('chart bar tool input rejects nonnumeric string series values', () => {
    const result = tavernRenderBarChartToolInputSchema.safeParse({
        data: [{ quarter: 'Q1', revenue: 'twelve thousand' }],
        title: 'Quarterly Revenue',
        x: 'quarter',
        y: 'revenue',
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
        title: 'Net Change',
        x: 'month',
        y: 'net',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
        throw new Error('Expected line chart tool input to parse.');
    }
    expect(result.data.data).toEqual([{ month: 'Jan', net: -12.5 }]);
});

test('widget render input accepts the composed chart widget demo payload', () => {
    const result = widgetRenderInputSchema.safeParse({
        component: tavernRenderComposedChartComponentId,
        fallback: { text: 'Revenue and Profit' },
        target: 'chat.inline',
        props: {
            barSeries: [{ key: 'revenue', label: 'Revenue' }],
            data: [
                { month: '2026-01-01', profit: 31, revenue: 120 },
                { month: '2026-02-01', profit: 34, revenue: 138 },
            ],
            lineSeries: [{ key: 'profit', label: 'Profit' }],
            title: 'Revenue and Profit',
            unit: 'USD',
            xKey: 'month',
        },
    });

    expect(result.success).toBe(true);
});

test('chart composed props accept signed line values on the secondary axis', () => {
    const result = tavernRenderComposedChartPropsSchema.safeParse({
        barSeries: [{ key: 'revenue', label: 'Revenue' }],
        data: [{ month: 'Jan', profit: -2, revenue: 120 }],
        lineSeries: [{ key: 'profit', label: 'Profit' }],
        title: 'Revenue and Profit',
        xKey: 'month',
    });

    expect(result.success).toBe(true);
});

test('chart composed props reject negative bar values', () => {
    const result = tavernRenderComposedChartPropsSchema.safeParse({
        barSeries: [{ key: 'units', label: 'Units' }],
        data: [{ month: 'Jan', profit: 12, units: -1 }],
        lineSeries: [{ key: 'profit', label: 'Profit' }],
        title: 'Units and Profit',
        xKey: 'month',
    });

    expect(result.success).toBe(false);
});

test('chart composed tool input normalizes numeric strings and split units', () => {
    const result = tavernRenderComposedChartToolInputSchema.safeParse({
        barUnit: 'units',
        barY: 'units',
        data: [{ month: '2026-01-01', royalties: '54.91', units: '19' }],
        lineUnit: 'USD',
        lineY: 'royalties',
        title: 'Units and Royalties',
        x: 'month',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
        throw new Error('Expected composed chart tool input to parse.');
    }
    expect(result.data).toEqual({
        barSeries: [{ key: 'units', label: 'Units' }],
        barUnit: 'units',
        data: [{ month: '2026-01-01', royalties: 54.91, units: 19 }],
        lineSeries: [{ key: 'royalties', label: 'Royalties' }],
        lineUnit: 'USD',
        title: 'Units and Royalties',
        xKey: 'month',
    });
});

test('chart composed tool input rejects too many total series', () => {
    const result = tavernRenderComposedChartToolInputSchema.safeParse({
        barY: ['one', 'two', 'three'],
        data: [{ month: 'Jan', five: 5, four: 4, one: 1, three: 3, two: 2 }],
        lineY: ['four', 'five'],
        title: 'Too Many Series',
        x: 'month',
    });

    expect(result.success).toBe(false);
});
