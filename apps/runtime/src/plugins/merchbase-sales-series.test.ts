import type { AgentRuntimeMerchbaseSalesSeries } from '@tavern/api';
import { describe, expect, test } from 'vitest';
import { shapeMerchbaseSalesSeriesForModel, todayIsoInTimezone } from './merchbase-sales-series.ts';

const today = '2026-07-17';

function salesSeries(
    query: Partial<AgentRuntimeMerchbaseSalesSeries['query']>,
    points: Partial<AgentRuntimeMerchbaseSalesSeries['series'][number]>[]
): AgentRuntimeMerchbaseSalesSeries {
    return {
        chartData: { data: [], title: 'MerchBase sales', unit: 'units', x: 'date', y: 'units' },
        query: { bucket: 'day', range: '30d', ...query },
        series: points.map((point) => ({
            bucketEnd: '2026-07-01',
            bucketStart: '2026-07-01',
            currencyCode: 'USD',
            netUnits: 0,
            revenue: 0,
            royalties: 0,
            unitsCancelled: 0,
            unitsReturned: 0,
            unitsSold: 0,
            ...point,
        })),
    };
}

describe('shapeMerchbaseSalesSeriesForModel', () => {
    test('zero-fills missing days across an explicit date range', () => {
        const shaped = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: '2026-07-01..2026-07-04' }, [
                {
                    bucketStart: '2026-07-01',
                    netUnits: 3,
                    revenue: 59.97,
                    royalties: 8.31,
                    unitsSold: 3,
                },
                {
                    bucketStart: '2026-07-03',
                    netUnits: 1,
                    revenue: 19.99,
                    royalties: 2.77,
                    unitsCancelled: 1,
                    unitsSold: 2,
                },
            ]),
            { today }
        );

        expect(shaped.rows.map((row) => row.date)).toEqual([
            '2026-07-01',
            '2026-07-02',
            '2026-07-03',
            '2026-07-04',
        ]);
        expect(shaped.rows[1]).toEqual({
            cancelled: 0,
            date: '2026-07-02',
            net: 0,
            returned: 0,
            revenue: 0,
            royalties: 0,
            sold: 0,
        });
        expect(shaped.rowCount).toBe(4);
        expect(shaped.totals).toEqual({
            cancelled: 1,
            net: 4,
            returned: 0,
            revenue: 79.96,
            royalties: 11.08,
            sold: 5,
        });
        expect(shaped.currencyCode).toBe('USD');
    });

    test('anchors relative day ranges on today and fills to the current day', () => {
        const shaped = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: '3d' }, [
                { bucketStart: '2026-07-16', netUnits: 2, unitsSold: 2 },
            ]),
            { today }
        );

        expect(shaped.rows.map((row) => row.date)).toEqual([
            '2026-07-15',
            '2026-07-16',
            '2026-07-17',
        ]);
        expect(shaped.rows.map((row) => row.sold)).toEqual([0, 2, 0]);
    });

    test('normalizes datetime bucket starts to ISO dates', () => {
        const shaped = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: '2026-07-01..2026-07-02' }, [
                { bucketStart: '2026-07-02T00:00:00.000Z', netUnits: 1, unitsSold: 1 },
            ]),
            { today }
        );

        expect(shaped.rows.map((row) => row.date)).toEqual(['2026-07-01', '2026-07-02']);
        expect(shaped.rows[1]?.sold).toBe(1);
    });

    test('returns explicit zero rows for an empty daily range', () => {
        const shaped = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: '2026-07-01..2026-07-03' }, []),
            { today }
        );

        expect(shaped.rowCount).toBe(3);
        expect(shaped.rows.every((row) => row.sold === 0 && row.net === 0)).toBe(true);
        expect(shaped.totals.sold).toBe(0);
    });

    test('fills only reported gaps when the range grammar is unknown', () => {
        const shaped = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: 'mtd' }, [
                { bucketStart: '2026-07-01', netUnits: 1, unitsSold: 1 },
                { bucketStart: '2026-07-03', netUnits: 1, unitsSold: 1 },
            ]),
            { today }
        );

        expect(shaped.rows.map((row) => row.date)).toEqual([
            '2026-07-01',
            '2026-07-02',
            '2026-07-03',
        ]);
    });

    test('skips zero-fill for week and month buckets and for oversized spans', () => {
        const weekly = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ bucket: 'week', range: '90d' }, [
                { bucketStart: '2026-06-29', netUnits: 4, unitsSold: 4 },
                { bucketStart: '2026-07-13', netUnits: 2, unitsSold: 2 },
            ]),
            { today }
        );
        expect(weekly.rows.map((row) => row.date)).toEqual(['2026-06-29', '2026-07-13']);

        const oversized = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: '4000d' }, [{ bucketStart: '2026-07-01', unitsSold: 1 }]),
            { today }
        );
        expect(oversized.rows.map((row) => row.date)).toEqual(['2026-07-01']);
    });

    test('resolves the currency code from points before the chart unit', () => {
        const fromPoints = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: '2026-07-01..2026-07-01' }, [
                { bucketStart: '2026-07-01', currencyCode: 'GBP' },
            ]),
            { today }
        );
        expect(fromPoints.currencyCode).toBe('GBP');

        const fallback = shapeMerchbaseSalesSeriesForModel(
            salesSeries({ range: '2026-07-01..2026-07-01' }, []),
            { today }
        );
        expect(fallback.currencyCode).toBe('USD');
    });
});

describe('todayIsoInTimezone', () => {
    test('formats the current date as YYYY-MM-DD', () => {
        expect(todayIsoInTimezone('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    });
});
