import { CollapseIcon, ExpandIcon } from '@hugeicons/core-free-icons';
import type {
    TavernRenderBarChartProps,
    TavernRenderComposedChartProps,
    TavernRenderLineChartProps,
} from '@tavern/api/widgets/charts';
import {
    tavernRenderBarChartComponentId,
    tavernRenderBarChartPropsSchema,
    tavernRenderComposedChartComponentId,
    tavernRenderComposedChartPropsSchema,
    tavernRenderLineChartComponentId,
    tavernRenderLineChartPropsSchema,
} from '@tavern/api/widgets/charts';
import { type ReactNode, useState } from 'react';
import { Area, AreaChart } from '../components/charts/area-chart.tsx';
import { Bar } from '../components/charts/bar.tsx';
import { BarChart } from '../components/charts/bar-chart.tsx';
import { BarXAxis } from '../components/charts/bar-x-axis.tsx';
import { ChartLegendHoverProvider } from '../components/charts/chart-legend-hover.tsx';
import { ComposedChart } from '../components/charts/composed-chart.tsx';
import { Grid } from '../components/charts/grid.tsx';
import { Line } from '../components/charts/line.tsx';
import { SeriesBar } from '../components/charts/series-bar.tsx';
import { ChartTooltip } from '../components/charts/tooltip/index.ts';
import { XAxis } from '../components/charts/x-axis.tsx';
import { YAxis } from '../components/charts/y-axis.tsx';
import { Icon } from '../components/ui/icon.tsx';
import { Button } from '../components/ui/primitives/button.tsx';
import { WidgetFrame } from '../components/widgets/widget-frame.tsx';
import { ChartLegend } from './chart-legend.tsx';
import {
    buildBarChartMargin,
    buildComposedChartMargin,
    buildComposedSeries,
    buildLegendItems,
    buildLineChartMargin,
    buildTooltipRows,
    chartStyleVars,
    composedLineMarkerStyle,
    lineYAxisId,
    normalizeLineChartData,
    seriesColor,
} from './chart-view-model.ts';
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

    if (widget.component === tavernRenderComposedChartComponentId) {
        const parsed = tavernRenderComposedChartPropsSchema.safeParse(widget.props);

        return parsed.success ? <TavernComposedChart props={parsed.data} /> : null;
    }

    return null;
}

function TavernBarChart({ props }: { props: TavernRenderBarChartProps }) {
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const legendItems = buildLegendItems(props);
    const margin = buildBarChartMargin(props);

    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <ChartWidgetFrame title={props.title}>
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
                        rows={(point) => buildTooltipRows(props.series, point, props.unit)}
                    />
                    <BarXAxis maxLabels={8} />
                </BarChart>
                <ChartLegend
                    hoveredIndex={hoveredSeriesIndex}
                    items={legendItems}
                    onHoverChange={setHoveredSeriesIndex}
                    unit={props.unit}
                />
            </ChartWidgetFrame>
        </ChartLegendHoverProvider>
    );
}

function TavernLineChart({ props }: { props: TavernRenderLineChartProps }) {
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const chartData = normalizeLineChartData(props);
    const legendItems = buildLegendItems(props);
    const margin = buildLineChartMargin(chartData, props.series);

    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <ChartWidgetFrame title={props.title}>
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
                    {props.series.length > 1 ? <YAxis orientation="right" yAxisId="right" /> : null}
                    <XAxis />
                    <ChartTooltip
                        indicatorColor={seriesColor(0)}
                        rows={(point) => buildTooltipRows(props.series, point, props.unit)}
                    />
                </AreaChart>
                <ChartLegend
                    hoveredIndex={hoveredSeriesIndex}
                    items={legendItems}
                    onHoverChange={setHoveredSeriesIndex}
                    unit={props.unit}
                />
            </ChartWidgetFrame>
        </ChartLegendHoverProvider>
    );
}

function TavernComposedChart({ props }: { props: TavernRenderComposedChartProps }) {
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const chartSeries = buildComposedSeries(props);
    const chartData = normalizeLineChartData({ ...props, series: chartSeries });
    const legendItems = buildLegendItems({ ...props, series: chartSeries });
    const margin = buildComposedChartMargin(chartData, chartSeries);
    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <ChartWidgetFrame title={props.title}>
                <ComposedChart
                    aspectRatio="16 / 9"
                    barGap={6}
                    data={chartData}
                    margin={margin}
                    maxBarSize={52}
                    xDataKey={props.xKey}
                >
                    <Grid horizontal={true} />
                    {props.barSeries.map((series, index) => (
                        <SeriesBar
                            dataKey={series.key}
                            fadedOpacity={0.18}
                            fill={seriesColor(index)}
                            key={series.key}
                            radius={10}
                        />
                    ))}
                    {props.lineSeries.map((series, index) => {
                        const colorIndex = props.barSeries.length + index;

                        return (
                            <Line
                                dataKey={series.key}
                                fadeEdges={true}
                                key={series.key}
                                markers={composedLineMarkerStyle(seriesColor(colorIndex))}
                                showMarkers={true}
                                stroke={seriesColor(colorIndex)}
                                strokeWidth={2.5}
                            />
                        );
                    })}
                    <YAxis yAxisId="left" />
                    <XAxis />
                    <ChartTooltip
                        indicatorColor={seriesColor(0)}
                        rows={(point) => buildTooltipRows(chartSeries, point, props.unit)}
                        showCrosshair={false}
                    />
                </ComposedChart>
                <ChartLegend
                    hoveredIndex={hoveredSeriesIndex}
                    items={legendItems}
                    onHoverChange={setHoveredSeriesIndex}
                    unit={props.unit}
                />
            </ChartWidgetFrame>
        </ChartLegendHoverProvider>
    );
}

function ChartWidgetFrame({ children, title }: { children: ReactNode; title: string }) {
    const [expanded, setExpanded] = useState(false);
    const toggleLabel = expanded ? 'Collapse chart' : 'Expand chart';

    return (
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
            title={title}
        >
            <div className="min-w-0" style={chartStyleVars}>
                {children}
            </div>
        </WidgetFrame>
    );
}
