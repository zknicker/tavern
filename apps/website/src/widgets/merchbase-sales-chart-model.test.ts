import { expect, test } from 'bun:test';
import type { AgentRuntimeMerchbaseSalesSeries } from '@tavern/api';
import {
    buildMerchBaseSalesChartView,
    dateKeyFromBucketStart,
} from './merchbase-sales-chart-model.ts';

test('dateKeyFromBucketStart normalizes MerchBase ISO datetime buckets', () => {
    expect(dateKeyFromBucketStart('2026-06-23T07:00:00.000Z')).toBe('2026-06-23');
});

test('dateKeyFromBucketStart preserves date-only buckets', () => {
    expect(dateKeyFromBucketStart('2026-06-23')).toBe('2026-06-23');
});

test('MerchBase sales chart fills missing daily buckets through the selected end date', () => {
    const view = buildMerchBaseSalesChartView({
        data: salesSeries({
            series: [
                salesPoint({
                    bucketEnd: '2026-06-24T06:59:59.999Z',
                    bucketStart: '2026-06-23T07:00:00.000Z',
                    currencyCode: 'USD',
                    netUnits: 7,
                    royalties: 22.5,
                    unitsSold: 8,
                }),
            ],
        }),
        endDate: '2026-06-24',
        startDate: '2026-06-22',
        title: 'Sales today',
    });

    expect(view.chartProps.data).toEqual([
        { bucket: '2026-06-22', royalties: 0, sales: 0 },
        { bucket: '2026-06-23', royalties: 22.5, sales: 7 },
        { bucket: '2026-06-24', royalties: 0, sales: 0 },
    ]);
    expect(view.series.at(-1)).toMatchObject({
        bucketStart: '2026-06-24',
        currencyCode: 'USD',
        netUnits: 0,
        royalties: 0,
        unitsSold: 0,
    });
});

test('MerchBase sales chart uses a currency fallback when all buckets are missing', () => {
    const view = buildMerchBaseSalesChartView({
        data: salesSeries({ chartUnit: 'royalties', series: [] }),
        endDate: '2026-06-24',
        startDate: '2026-06-24',
        title: 'Sales today',
    });

    expect(view.currencyCode).toBe('USD');
    expect(view.series).toEqual([
        {
            bucketEnd: '2026-06-24',
            bucketStart: '2026-06-24',
            currencyCode: 'USD',
            netUnits: 0,
            revenue: 0,
            royalties: 0,
            unitsCancelled: 0,
            unitsReturned: 0,
            unitsSold: 0,
        },
    ]);
});

function salesSeries(input: {
    chartUnit?: string;
    series: AgentRuntimeMerchbaseSalesSeries['series'];
}): AgentRuntimeMerchbaseSalesSeries {
    return {
        chartData: {
            data: [],
            title: 'Sales',
            unit: input.chartUnit ?? 'USD',
            x: 'bucket',
            y: 'sales',
        },
        query: {
            bucket: 'day',
            range: '2026-06-22..2026-06-24',
        },
        series: input.series,
    };
}

function salesPoint(
    input: Partial<AgentRuntimeMerchbaseSalesSeries['series'][number]>
): AgentRuntimeMerchbaseSalesSeries['series'][number] {
    return {
        bucketEnd: '2026-06-23',
        bucketStart: '2026-06-23',
        currencyCode: 'USD',
        netUnits: 0,
        revenue: 0,
        royalties: 0,
        unitsCancelled: 0,
        unitsReturned: 0,
        unitsSold: 0,
        ...input,
    };
}
