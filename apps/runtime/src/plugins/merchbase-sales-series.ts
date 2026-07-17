import type { AgentRuntimeMerchbaseSalesSeries } from '@tavern/api';

/**
 * Model-facing shape for the merchbase_sales_series agent tool: compact rows
 * keyed by ISO date, explicit zero-sales days for daily ranges, and summed
 * totals. Presentation stays with the agent; this module only shapes data.
 */

export interface MerchbaseSalesSeriesToolTotals {
    cancelled: number;
    net: number;
    returned: number;
    revenue: number;
    royalties: number;
    sold: number;
}

export interface MerchbaseSalesSeriesToolRow extends MerchbaseSalesSeriesToolTotals {
    date: string;
}

export interface MerchbaseSalesSeriesToolResult {
    bucket: 'day' | 'month' | 'week';
    currencyCode: string;
    range: string;
    rowCount: number;
    rows: MerchbaseSalesSeriesToolRow[];
    totals: MerchbaseSalesSeriesToolTotals;
}

type MerchbaseSalesPoint = AgentRuntimeMerchbaseSalesSeries['series'][number];

// Zero-filling a huge span would flood the model; past this the tool returns
// only the days MerchBase reported.
const maxZeroFilledDays = 366;

/**
 * `today` anchors relative ranges such as "30d"; pass the home-timezone date.
 */
export function shapeMerchbaseSalesSeriesForModel(
    series: AgentRuntimeMerchbaseSalesSeries,
    options: { today: string }
): MerchbaseSalesSeriesToolResult {
    const pointsByDate = new Map(
        series.series.map((point) => [isoDateFromBucketStart(point.bucketStart), point] as const)
    );
    const reportedDates = [...pointsByDate.keys()].sort((a, b) => a.localeCompare(b));
    const dates =
        series.query.bucket === 'day'
            ? (resolveDailyDates({
                  range: series.query.range,
                  reportedDates,
                  today: options.today,
              }) ?? reportedDates)
            : reportedDates;
    const rows = dates.map((date) => toRow(date, pointsByDate.get(date)));

    return {
        bucket: series.query.bucket,
        currencyCode: resolveCurrencyCode(series),
        range: series.query.range,
        rowCount: rows.length,
        rows,
        totals: sumTotals(rows),
    };
}

export function todayIsoInTimezone(timezone: string): string {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    }).format(new Date());
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const explicitRangePattern = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/u;
const relativeDaysRangePattern = /^(\d{1,4})d$/u;

function resolveDailyDates(input: {
    range: string;
    reportedDates: string[];
    today: string;
}): string[] | null {
    const span = resolveRangeSpan(input.range, input.today) ?? spanFromDates(input.reportedDates);
    if (!span || span.end < span.start || inclusiveDayCount(span) > maxZeroFilledDays) {
        return null;
    }
    return listInclusiveDates(span.start, span.end);
}

function resolveRangeSpan(range: string, today: string) {
    const explicit = explicitRangePattern.exec(range);
    if (explicit) {
        return { end: explicit[2] as string, start: explicit[1] as string };
    }

    const relative = relativeDaysRangePattern.exec(range);
    if (relative) {
        const days = Number(relative[1]);
        if (days >= 1 && isoDatePattern.test(today)) {
            return { end: today, start: shiftIsoDate(today, -(days - 1)) };
        }
    }

    return null;
}

function spanFromDates(dates: string[]) {
    const isoDates = dates.filter((date) => isoDatePattern.test(date));
    return isoDates.length > 0
        ? { end: isoDates.at(-1) as string, start: isoDates[0] as string }
        : null;
}

function inclusiveDayCount(span: { end: string; start: string }) {
    const millis = Date.parse(`${span.end}T00:00:00Z`) - Date.parse(`${span.start}T00:00:00Z`);
    return millis / 86_400_000 + 1;
}

function listInclusiveDates(start: string, end: string) {
    const dates: string[] = [];
    for (let date = start; date <= end; date = shiftIsoDate(date, 1)) {
        dates.push(date);
    }
    return dates;
}

function shiftIsoDate(date: string, days: number) {
    const shifted = new Date(`${date}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
}

function isoDateFromBucketStart(value: string) {
    const datePart = value.slice(0, 10);
    if (isoDatePattern.test(datePart)) {
        return datePart;
    }

    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : value;
}

function toRow(date: string, point: MerchbaseSalesPoint | undefined): MerchbaseSalesSeriesToolRow {
    return {
        cancelled: point?.unitsCancelled ?? 0,
        date,
        net: point?.netUnits ?? 0,
        returned: point?.unitsReturned ?? 0,
        revenue: point?.revenue ?? 0,
        royalties: point?.royalties ?? 0,
        sold: point?.unitsSold ?? 0,
    };
}

function sumTotals(rows: MerchbaseSalesSeriesToolRow[]): MerchbaseSalesSeriesToolTotals {
    const totals = { cancelled: 0, net: 0, returned: 0, revenue: 0, royalties: 0, sold: 0 };
    for (const row of rows) {
        totals.cancelled += row.cancelled;
        totals.net += row.net;
        totals.returned += row.returned;
        totals.revenue += row.revenue;
        totals.royalties += row.royalties;
        totals.sold += row.sold;
    }
    totals.revenue = roundToCents(totals.revenue);
    totals.royalties = roundToCents(totals.royalties);
    return totals;
}

function roundToCents(value: number) {
    return Math.round(value * 100) / 100;
}

const currencyCodePattern = /^[A-Z]{3}$/u;

function resolveCurrencyCode(series: AgentRuntimeMerchbaseSalesSeries) {
    return (
        series.series.find((point) => currencyCodePattern.test(point.currencyCode))?.currencyCode ??
        (currencyCodePattern.test(series.chartData.unit) ? series.chartData.unit : 'USD')
    );
}
