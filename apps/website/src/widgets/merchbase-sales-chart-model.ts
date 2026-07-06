import type { AgentRuntimeMerchbaseSalesSeries, WidgetComposedChartProps } from '@tavern/api';
import { dateKeyFromBucketStart, shiftIsoDate } from './merchbase-date.ts';

type MerchBaseSalesPoint = AgentRuntimeMerchbaseSalesSeries['series'][number];

export function buildMerchBaseSalesChartView(input: {
    data: AgentRuntimeMerchbaseSalesSeries;
    endDate: string;
    startDate: string;
    title: string;
}): {
    chartProps: WidgetComposedChartProps;
    currencyCode: string;
    series: MerchBaseSalesPoint[];
} {
    const currencyCode = resolveCurrencyCode(input.data);
    const series = normalizeDailySalesSeries({
        currencyCode,
        endDate: input.endDate,
        series: input.data.series,
        startDate: input.startDate,
    });

    return {
        chartProps: {
            barSeries: [{ key: 'sales', label: 'Sales' }],
            data: series.map((point) => ({
                bucket: dateKeyFromBucketStart(point.bucketStart),
                royalties: point.royalties,
                sales: point.netUnits,
            })),
            lineSeries: [{ key: 'royalties', label: 'Royalties' }],
            lineUnit: currencyCode,
            title: input.title,
            xKey: 'bucket',
        },
        currencyCode,
        series,
    };
}

function normalizeDailySalesSeries(input: {
    currencyCode: string;
    endDate: string;
    series: MerchBaseSalesPoint[];
    startDate: string;
}) {
    const pointsByDate = new Map(
        input.series.map((point) => [dateKeyFromBucketStart(point.bucketStart), point])
    );

    return listInclusiveDates(input.startDate, input.endDate).map(
        (date) => pointsByDate.get(date) ?? zeroSalesPoint(date, input.currencyCode)
    );
}

function listInclusiveDates(startDate: string, endDate: string) {
    const dates: string[] = [];
    for (let date = startDate; date <= endDate; date = shiftIsoDate(date, 1)) {
        dates.push(date);
    }
    return dates;
}

function zeroSalesPoint(date: string, currencyCode: string): MerchBaseSalesPoint {
    return {
        bucketEnd: date,
        bucketStart: date,
        currencyCode,
        netUnits: 0,
        revenue: 0,
        royalties: 0,
        unitsCancelled: 0,
        unitsReturned: 0,
        unitsSold: 0,
    };
}

function resolveCurrencyCode(data: AgentRuntimeMerchbaseSalesSeries) {
    return (
        data.series.find((point) => isCurrencyCode(point.currencyCode))?.currencyCode ??
        (isCurrencyCode(data.chartData.unit) ? data.chartData.unit : null) ??
        'USD'
    );
}

function isCurrencyCode(value: string) {
    return /^[A-Z]{3}$/u.test(value);
}
