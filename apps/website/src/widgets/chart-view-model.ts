import type {
    TavernRenderBarChartProps,
    TavernRenderLineChartProps,
} from '@tavern/api/widgets/charts';
import type { CSSProperties } from 'react';
import { buildPackedChartMargin } from '../components/charts/axis-packing.ts';
import { intFmt } from '../components/charts/chart-formatters.ts';
import type { LegendItemData } from '../components/charts/legend/index.ts';
import type { TooltipRow } from '../components/charts/tooltip/index.ts';

export function buildLegendItems(
    props: TavernRenderBarChartProps | TavernRenderLineChartProps
): LegendItemData[] {
    const lastPoint = props.data.at(-1) ?? {};

    return props.series.map((series, index) => ({
        color: seriesColor(index),
        label: series.label,
        maxValue: maxSeriesValue(props.data, series.key),
        value: numericValue(lastPoint[series.key]),
    }));
}

export function buildTooltipRows(
    series: TavernRenderBarChartProps['series'],
    point: Record<string, unknown>,
    unit?: string
): TooltipRow[] {
    return series.map((item, index) => ({
        color: seriesColor(index),
        label: item.label,
        value: formatChartValue(numericValue(point[item.key]), unit),
    }));
}

export function formatChartValue(value: number, unit?: string) {
    const formatted = intFmt(value);
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

export function buildBarChartMargin(props: TavernRenderBarChartProps) {
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

export function buildLineChartMargin(
    data: Record<string, unknown>[],
    series: TavernRenderLineChartProps['series']
) {
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

export function normalizeLineChartData(props: TavernRenderLineChartProps) {
    const baseTime = Date.UTC(2026, 0, 1);

    return props.data.map((point, index) => {
        const xValue = point[props.xKey];
        const parsedDate =
            typeof xValue === 'string' || typeof xValue === 'number' ? new Date(xValue) : null;

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

function maxSeriesValue(data: Record<string, string | number | boolean | null>[], key: string) {
    return data.reduce((max, point) => Math.max(max, numericValue(point[key])), 0);
}

function numericValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const chartSeriesColors = [
    'var(--chart-line-primary)',
    'var(--chart-line-secondary)',
    'var(--chart-line-tertiary)',
    'var(--chart-line-quaternary)',
];
