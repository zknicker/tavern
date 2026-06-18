import { CollapseIcon, ExpandIcon } from '@hugeicons/core-free-icons';
import type {
    TavernRenderBarChartProps,
    TavernRenderLineChartProps,
} from '@tavern/api/widgets/charts';
import {
    tavernRenderBarChartComponentId,
    tavernRenderBarChartPropsSchema,
    tavernRenderLineChartComponentId,
    tavernRenderLineChartPropsSchema,
} from '@tavern/api/widgets/charts';
import { type CSSProperties, useState } from 'react';
import { Area, AreaChart } from '../components/charts/area-chart.tsx';
import { buildPackedChartMargin } from '../components/charts/axis-packing.ts';
import { Bar } from '../components/charts/bar.tsx';
import { BarChart } from '../components/charts/bar-chart.tsx';
import { BarXAxis } from '../components/charts/bar-x-axis.tsx';
import { ChartLegendHoverProvider } from '../components/charts/chart-legend-hover.tsx';
import { Grid } from '../components/charts/grid.tsx';
import {
    Legend,
    LegendItem,
    type LegendItemData,
    LegendLabel,
    LegendMarker,
    LegendValue,
} from '../components/charts/legend/index.ts';
import { ChartTooltip, type TooltipRow } from '../components/charts/tooltip/index.ts';
import { XAxis } from '../components/charts/x-axis.tsx';
import { YAxis } from '../components/charts/y-axis.tsx';
import { Icon } from '../components/ui/icon.tsx';
import { Button } from '../components/ui/primitives/button.tsx';
import { WidgetFrame } from '../components/widgets/widget-frame.tsx';
import type { TavernWidget } from './types.ts';

export function renderChartWidget(widget: TavernWidget): React.ReactNode {
    if (widget.component === tavernRenderBarChartComponentId) {
        const parsed = tavernRenderBarChartPropsSchema.safeParse(widget.props);

        return parsed.success ? <TavernBarChart props={parsed.data} /> : null;
    }

    if (widget.component === tavernRenderLineChartComponentId) {
        const parsed = tavernRenderLineChartPropsSchema.safeParse(widget.props);

        return parsed.success ? <TavernLineChart props={parsed.data} /> : null;
    }

    return null;
}

function TavernBarChart({ props }: { props: TavernRenderBarChartProps }) {
    const [expanded, setExpanded] = useState(false);
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const toggleLabel = expanded ? 'Collapse chart' : 'Expand chart';
    const legendItems = buildLegendItems(props);
    const margin = buildPackedChartMargin({
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

    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <WidgetFrame
                action={
                    <Button
                        aria-label={toggleLabel}
                        aria-pressed={expanded}
                        className="shrink-0 rounded-md text-muted-foreground/75 hover:text-foreground"
                        onClick={() => setExpanded((value) => !value)}
                        size="icon-sm"
                        title={toggleLabel}
                        variant="ghost"
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-4"
                            icon={expanded ? CollapseIcon : ExpandIcon}
                            strokeWidth={2.4}
                        />
                    </Button>
                }
                expanded={expanded}
                title={props.title}
            >
                <div className="min-w-0" style={chartStyleVars}>
                    <BarChart
                        aspectRatio="16 / 9"
                        barGap={0.2}
                        barOuterGap={0.06}
                        data={props.data}
                        margin={margin}
                        xDataKey={props.xKey}
                    >
                        <Grid horizontal={true} vertical={false} />
                        <YAxis yAxisId="left" />
                        {props.series.map((series, index) => (
                            <Bar
                                dataKey={series.key}
                                fadedOpacity={0.18}
                                fill={seriesColor(index)}
                                groupGap={6}
                                key={series.key}
                                lineCap={12}
                            />
                        ))}
                        <ChartTooltip
                            indicatorDasharray="4,4"
                            rows={(point) => buildTooltipRows(props.series, point)}
                        />
                        <BarXAxis maxLabels={8} />
                    </BarChart>
                    <ChartLegend
                        hoveredIndex={hoveredSeriesIndex}
                        items={legendItems}
                        onHoverChange={setHoveredSeriesIndex}
                    />
                </div>
            </WidgetFrame>
        </ChartLegendHoverProvider>
    );
}

function TavernLineChart({ props }: { props: TavernRenderLineChartProps }) {
    const [expanded, setExpanded] = useState(false);
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const toggleLabel = expanded ? 'Collapse chart' : 'Expand chart';
    const chartData = normalizeLineChartData(props);
    const legendItems = buildLegendItems(props);
    const margin = buildLineChartMargin(chartData, props.series);

    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <WidgetFrame
                action={
                    <Button
                        aria-label={toggleLabel}
                        aria-pressed={expanded}
                        className="shrink-0 rounded-md text-muted-foreground/75 hover:text-foreground"
                        onClick={() => setExpanded((value) => !value)}
                        size="icon-sm"
                        title={toggleLabel}
                        variant="ghost"
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-4"
                            icon={expanded ? CollapseIcon : ExpandIcon}
                            strokeWidth={2.4}
                        />
                    </Button>
                }
                expanded={expanded}
                title={props.title}
            >
                <div className="min-w-0" style={chartStyleVars}>
                    <AreaChart
                        aspectRatio="16 / 9"
                        data={chartData}
                        margin={margin}
                        xDataKey={props.xKey}
                    >
                        <Grid horizontal={true} />
                        {props.series.map((series, index) => (
                            <Area
                                dataKey={series.key}
                                fadeEdges={true}
                                fill={seriesColor(index)}
                                fillOpacity={props.series.length > 1 ? 0.18 : 0.3}
                                key={series.key}
                                stroke={seriesColor(index)}
                                strokeWidth={2.5}
                                yAxisId={lineYAxisId(index)}
                            />
                        ))}
                        <YAxis yAxisId="left" />
                        {props.series.length > 1 ? (
                            <YAxis orientation="right" yAxisId="right" />
                        ) : null}
                        <XAxis />
                        <ChartTooltip
                            indicatorColor={seriesColor(0)}
                            rows={(point) => buildTooltipRows(props.series, point)}
                        />
                    </AreaChart>
                    <ChartLegend
                        hoveredIndex={hoveredSeriesIndex}
                        items={legendItems}
                        onHoverChange={setHoveredSeriesIndex}
                    />
                </div>
            </WidgetFrame>
        </ChartLegendHoverProvider>
    );
}

function ChartLegend({
    hoveredIndex,
    items,
    onHoverChange,
}: {
    hoveredIndex: null | number;
    items: LegendItemData[];
    onHoverChange: (index: null | number) => void;
}) {
    return (
        <Legend
            className="mt-2 flex w-fit max-w-full flex-row flex-wrap gap-x-5 gap-y-1"
            hoveredIndex={hoveredIndex}
            items={items}
            onHoverChange={onHoverChange}
        >
            <LegendItem className="group flex min-w-0 items-center gap-2 hover:bg-muted data-[hovered]:bg-muted">
                <LegendMarker className="size-2.5" />
                <LegendLabel className="min-w-0 truncate font-medium text-sm" />
                <LegendValue className="font-medium text-sm tabular-nums group-data-[hovered]:text-foreground" />
            </LegendItem>
        </Legend>
    );
}

function buildLegendItems(
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

function buildTooltipRows(
    series: TavernRenderBarChartProps['series'],
    point: Record<string, unknown>
): TooltipRow[] {
    return series.map((item, index) => ({
        color: seriesColor(index),
        label: item.label,
        value: numericValue(point[item.key]),
    }));
}

function maxSeriesValue(data: Record<string, string | number | boolean | null>[], key: string) {
    return data.reduce((max, point) => Math.max(max, numericValue(point[key])), 0);
}

function numericValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function seriesColor(index: number) {
    return chartSeriesColors[index % chartSeriesColors.length] ?? chartSeriesColors[0];
}

function lineYAxisId(index: number) {
    return index === 1 ? 'right' : 'left';
}

function buildLineChartMargin(
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

function normalizeLineChartData(props: TavernRenderLineChartProps) {
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

const chartSeriesColors = [
    'var(--chart-line-primary)',
    'var(--chart-line-secondary)',
    'var(--chart-line-tertiary)',
    'var(--chart-line-quaternary)',
];

const chartStyleVars = {
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
