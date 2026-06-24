import { AmazonIcon } from '@hugeicons-pro/core-solid-rounded';
import { keepPreviousData } from '@tanstack/react-query';
import type { RichResponseMerchBaseSalesChartProps } from '@tavern/api/rich-responses/merchbase';
import { memo, useCallback, useMemo, useState } from 'react';
import { RichResponseFrame } from '../components/rich-responses/rich-response-frame.tsx';
import { Icon } from '../components/ui/icon.tsx';
import { queryPolicy } from '../lib/query-policy.ts';
import { type MerchbaseSalesSeriesOutput, trpc } from '../lib/trpc.tsx';
import { cn } from '../lib/utils.ts';
import { chartStyleVars } from './chart-view-model.ts';
import { RichResponseComposedChartBody } from './charts.tsx';
import { dateKeyFromBucketStart, formatIsoDate, shiftIsoDate } from './merchbase-date.ts';
import { DateRangeSelector } from './merchbase-date-range-selector.tsx';
import { buildMerchBaseSalesChartView } from './merchbase-sales-chart-model.ts';

export function RichResponseMerchBaseSalesChart({
    props,
}: {
    props: RichResponseMerchBaseSalesChartProps;
}) {
    const initialEndDate = props.endDate ?? formatIsoDate(new Date());
    const [endDate, setEndDate] = useState(initialEndDate);
    const [startDate, setStartDate] = useState(() =>
        shiftIsoDate(initialEndDate, -(props.rangeDays - 1))
    );
    const range = useMemo(() => `${startDate}..${endDate}`, [endDate, startDate]);
    const handleRangeChange = useCallback((nextStartDate: string, nextEndDate: string) => {
        setStartDate(nextStartDate);
        setEndDate(nextEndDate);
    }, []);
    const query = trpc.integration.merchbaseSalesSeries.useQuery(
        {
            asin: props.asin,
            bucket: 'day',
            color: props.color,
            facet: props.facet,
            facetName: props.facetName,
            fit: props.fit,
            marketplace: props.marketplace,
            productType: props.productType,
            range,
        },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            placeholderData: keepPreviousData,
        }
    );

    const rangeControl = (
        <DateRangeSelector
            endDate={endDate}
            onRangeChange={handleRangeChange}
            startDate={startDate}
        />
    );

    return (
        <RichResponseFrame
            contentClassName="p-6"
            size="full"
            title={<MerchBaseTitle />}
            titleAction={rangeControl}
        >
            <div className="min-w-0" style={chartStyleVars}>
                <MerchBaseSalesChartBody
                    data={query.data}
                    endDate={endDate}
                    error={query.error}
                    key={range}
                    loading={query.isLoading}
                    selectedDate={endDate}
                    startDate={startDate}
                    title={props.title}
                />
            </div>
        </RichResponseFrame>
    );
}

function MerchBaseSalesChartBody({
    data,
    endDate,
    error,
    loading,
    selectedDate,
    startDate,
    title,
}: {
    data: MerchbaseSalesSeriesOutput | undefined;
    endDate: string;
    error: { message: string } | null;
    loading: boolean;
    selectedDate: string;
    startDate: string;
    title: string;
}) {
    const [activeIndex, setActiveIndex] = useState<null | number>(null);
    const chartView = useMemo(
        () => (data ? buildMerchBaseSalesChartView({ data, endDate, startDate, title }) : null),
        [data, endDate, startDate, title]
    );
    const handleActiveIndexChange = useCallback((nextIndex: null | number) => {
        setActiveIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
    }, []);

    if (loading) {
        return <ChartState text="Loading MerchBase sales..." />;
    }

    if (error) {
        return <ChartState text={error.message} tone="error" />;
    }

    if (!chartView) {
        return <ChartState text="No MerchBase sales found for this range." />;
    }

    const activePoint =
        (activeIndex === null ? null : chartView.series[activeIndex]) ??
        chartView.series.find(
            (item) => dateKeyFromBucketStart(item.bucketStart) === selectedDate
        ) ??
        chartView.series.at(-1);
    const xAxisTickCount = Math.min(chartView.series.length, merchBaseXAxisMaxTicks);

    return (
        <>
            {activePoint ? <PointSummary point={activePoint} /> : null}
            <MemoizedComposedChartBody
                chartMargin={merchBaseChartMargin}
                datePillBottom={merchBaseDatePillBottom}
                onActiveIndexChange={handleActiveIndexChange}
                props={chartView.chartProps}
                showLegend={false}
                xAxisLabelBottom={merchBaseXAxisLabelBottom}
                xAxisTickCount={xAxisTickCount}
            />
        </>
    );
}

function MerchBaseTitle() {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="grid size-4.5 shrink-0 place-items-center text-[#ff9900]">
                <Icon className="size-4.5" icon={AmazonIcon} />
            </span>
            <span className="min-w-0 truncate">Amazon Merch Sales</span>
        </span>
    );
}

function ChartState({ text, tone = 'muted' }: { text: string; tone?: 'error' | 'muted' }) {
    return (
        <div
            className={cn(
                'flex min-h-36 items-center justify-center rounded-lg border border-border/70 px-3 text-center text-sm',
                tone === 'error' ? 'text-destructive-foreground' : 'text-muted-foreground'
            )}
        >
            {text}
        </div>
    );
}

function PointSummary({ point }: { point: MerchbaseSalesSeriesOutput['series'][number] }) {
    return (
        <section className="mb-3 flex w-fit max-w-full flex-wrap items-start justify-start gap-x-8 gap-y-3 sm:gap-x-10">
            <SummaryMetric
                color="var(--chart-line-primary)"
                label="Sold"
                value={intFmt.format(point.unitsSold)}
            />
            <SummaryMetric label="Cancelled" value={intFmt.format(point.unitsCancelled)} />
            <SummaryMetric label="Returns" value={intFmt.format(point.unitsReturned)} />
            <SummaryMetric
                color="var(--chart-line-secondary)"
                label="Royalties"
                value={formatMoney(point.royalties, point.currencyCode)}
            />
        </section>
    );
}

const MemoizedComposedChartBody = memo(RichResponseComposedChartBody);

function SummaryMetric({ color, label, value }: { color?: string; label: string; value: string }) {
    return (
        <div className="w-24 min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
                <div className="whitespace-nowrap text-muted-foreground text-xs uppercase leading-none">
                    {label}
                </div>
                {color ? (
                    <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                    />
                ) : null}
            </div>
            <div className="mt-1 whitespace-nowrap font-bold font-mono text-2xl text-foreground tabular-nums leading-none">
                {value}
            </div>
        </div>
    );
}

function formatMoney(value: number, currencyCode: string) {
    return new Intl.NumberFormat('en-US', {
        currency: currencyCode,
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: 'currency',
    }).format(value);
}

const intFmt = new Intl.NumberFormat('en-US');
const merchBaseChartMargin = { bottom: 24, left: 24, right: 24 };
const merchBaseXAxisMaxTicks = 14;
const merchBaseXAxisLabelBottom = 0;
const merchBaseDatePillBottom = merchBaseXAxisLabelBottom - 8;
