import type { CSSProperties } from 'react';
import { buildPackedChartMargin } from '../components/charts/axis-packing.ts';
import { intFmt } from '../components/charts/chart-formatters.ts';
import type { LegendItemData } from '../components/charts/legend/index.ts';
import type { TooltipRow } from '../components/charts/tooltip/index.ts';

export type ChartDatum = Record<string, string | number | boolean | null>;

export interface ChartSeries {
    key: string;
    label: string;
}

export interface BarChartProps {
    data: ChartDatum[];
    series: ChartSeries[];
    unit?: string;
    xKey: string;
}

export type LineChartProps = BarChartProps;

export interface ComposedChartProps {
    barSeries: ChartSeries[];
    barUnit?: string;
    data: ChartDatum[];
    lineSeries: ChartSeries[];
    lineUnit?: string;
    unit?: string;
    xKey: string;
}

export type ChartLegendItemData = LegendItemData & { unit?: string };

type ChartUnitResolver =
    | string
    | ((series: ChartSeries, index: number) => string | undefined)
    | undefined;

interface ChartValueProps {
    data: ChartDatum[];
    series: ChartSeries[];
    unit?: string;
    xKey: string;
}

export function buildLegendItems(
    props: ChartValueProps,
    unit: ChartUnitResolver = props.unit
): ChartLegendItemData[] {
    const lastPoint = props.data.at(-1) ?? {};

    return props.series.map((series, index) => ({
        color: seriesColor(index),
        label: series.label,
        maxValue: maxSeriesValue(props.data, series.key),
        unit: chartUnitForSeries(unit, series, index),
        value: numericValue(lastPoint[series.key]),
    }));
}

export function buildTooltipRows(
    series: ChartSeries[],
    point: Record<string, unknown>,
    unit?: ChartUnitResolver
): TooltipRow[] {
    return series.map((item, index) => ({
        color: seriesColor(index),
        label: item.label,
        value: formatChartValue(
            numericValue(point[item.key]),
            chartUnitForSeries(unit, item, index)
        ),
    }));
}

export function formatChartValue(value: number, unit?: string) {
    const formatted = formatNumericChartValue(value);
    const label = unit?.trim();

    if (!label) {
        return formatted;
    }

    if (label.toUpperCase() === 'USD') {
        return `$${formatted}`;
    }

    if (label === '$') {
        return `$${formatted}`;
    }

    if (label === '%') {
        return `${formatted}%`;
    }

    return `${formatted} ${label}`;
}

export function seriesColor(index: number) {
    return chartSeriesColors[index % chartSeriesColors.length] ?? chartSeriesColors[0];
}

export function lineYAxisId(index: number) {
    return index === 1 ? 'right' : 'left';
}

export function composedLineMarkerStyle(color: string) {
    return {
        fill: 'var(--chart-background)',
        inactiveBlur: 0,
        radius: 4.5,
        ringGap: 0,
        showActiveHighlight: false,
        stroke: color,
        strokeWidth: 2.25,
    };
}

export function buildBarChartMargin(props: BarChartProps) {
    return buildPackedChartMargin({
        base: { bottom: 44, left: 30, right: 18, top: 24 },
        data: props.data,
        yAxes: [
            {
                keys: props.series.map((series) => series.key),
                max: 48,
                min: 30,
                side: 'left',
            },
        ],
    });
}

export function buildLineChartMargin(data: Record<string, unknown>[], series: ChartSeries[]) {
    const leftSeriesKeys = series
        .filter((_, index) => lineYAxisId(index) === 'left')
        .map((series) => series.key);
    const rightSeriesKeys = series
        .filter((_, index) => lineYAxisId(index) === 'right')
        .map((series) => series.key);

    return buildPackedChartMargin({
        base: { bottom: 40, left: 30, right: 18, top: 24 },
        data,
        emptySideMargin: { right: 18 },
        yAxes: [
            { keys: leftSeriesKeys, max: 48, min: 30, side: 'left' },
            { keys: rightSeriesKeys, max: 48, min: 30, side: 'right' },
        ],
    });
}

export function buildComposedChartMargin(
    data: Record<string, unknown>[],
    props: ComposedChartProps
) {
    const barUnit = composedBarUnit(props);
    const lineUnit = composedLineUnit(props);

    return buildPackedChartMargin({
        base: { bottom: 40, left: 30, right: 30, top: 24 },
        data,
        yAxes: [
            {
                formatValue: (value) => formatChartValue(value, barUnit),
                keys: props.barSeries.map((item) => item.key),
                max: axisMarginMax(barUnit),
                min: 30,
                side: 'left',
            },
            {
                formatValue: (value) => formatChartValue(value, lineUnit),
                keys: props.lineSeries.map((item) => item.key),
                max: axisMarginMax(lineUnit),
                min: 30,
                side: 'right',
            },
        ],
    });
}

export function buildComposedSeries(props: ComposedChartProps): ChartSeries[] {
    return [...props.barSeries, ...props.lineSeries];
}

export function composedBarUnit(props: ComposedChartProps) {
    return props.barUnit ?? props.unit;
}

export function composedLineUnit(props: ComposedChartProps) {
    return props.lineUnit ?? props.unit;
}

export function composedSeriesUnit(props: ComposedChartProps, index: number) {
    return index < props.barSeries.length ? composedBarUnit(props) : composedLineUnit(props);
}

export function normalizeLineChartData(props: ChartValueProps) {
    const baseTime = Date.UTC(2026, 0, 1);

    return props.data.map((point, index) => {
        const xValue = point[props.xKey];
        const parsedDate = parseChartDate(xValue);

        return {
            ...point,
            [props.xKey]:
                parsedDate && Number.isFinite(parsedDate.getTime())
                    ? parsedDate
                    : new Date(baseTime + index * 86_400_000),
        };
    });
}

export const chartStyleVars = {
    '--chart-background': 'var(--surface-3)',
    '--chart-crosshair': 'var(--chart-line-primary)',
    '--chart-grid': 'color-mix(in srgb, var(--border-strong) 58%, transparent)',
    '--chart-label': 'color-mix(in srgb, var(--muted-foreground) 86%, transparent)',
    '--chart-line-primary': 'var(--color-cyan-300)',
    '--chart-line-secondary': 'var(--color-cyan-500)',
    '--chart-line-tertiary': 'var(--brand)',
    '--chart-line-quaternary': 'var(--info)',
    '--chart-tooltip-background': 'color-mix(in srgb, var(--foreground) 88%, transparent)',
    '--chart-tooltip-foreground': 'var(--background)',
    '--chart-tooltip-muted': 'color-mix(in srgb, var(--background) 62%, transparent)',
    '--legend-foreground': 'var(--foreground)',
    '--legend-muted': 'color-mix(in srgb, var(--foreground) 8%, transparent)',
    '--legend-muted-foreground': 'var(--muted-foreground)',
    '--legend-track': 'var(--border)',
} as CSSProperties;

function maxSeriesValue(data: ChartDatum[], key: string) {
    return data.reduce((max, point) => Math.max(max, numericValue(point[key])), 0);
}

function numericValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatNumericChartValue(value: number) {
    return Number.isInteger(value) ? intFmt(value) : decimalFmt.format(value);
}

function chartUnitForSeries(unit: ChartUnitResolver, series: ChartSeries, index: number) {
    return typeof unit === 'function' ? unit(series, index) : unit;
}

function axisMarginMax(unit?: string) {
    return unit ? 72 : 48;
}

function parseChartDate(value: unknown) {
    if (typeof value === 'number') {
        return new Date(value);
    }

    if (typeof value !== 'string') {
        return null;
    }

    const dateOnlyMatch = dateOnlyPattern.exec(value);
    if (!dateOnlyMatch) {
        return new Date(value);
    }

    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
}

const chartSeriesColors = [
    'var(--chart-line-primary)',
    'var(--chart-line-secondary)',
    'var(--chart-line-tertiary)',
    'var(--chart-line-quaternary)',
];

const decimalFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
