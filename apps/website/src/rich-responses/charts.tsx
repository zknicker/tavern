import type {
    RichResponseBarChartProps,
    RichResponseComposedChartProps,
    RichResponseLineChartProps,
} from '@tavern/api/rich-responses/charts';
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
import { RichResponseFrame } from '../components/rich-responses/rich-response-frame.tsx';
import { ChartLegend } from './chart-legend.tsx';
import {
    buildBarChartMargin,
    buildComposedChartMargin,
    buildComposedSeries,
    buildLegendItems,
    buildLineChartMargin,
    buildTooltipRows,
    chartStyleVars,
    composedBarUnit,
    composedLineMarkerStyle,
    composedLineUnit,
    composedSeriesUnit,
    formatChartValue,
    lineYAxisId,
    normalizeLineChartData,
    seriesColor,
} from './chart-view-model.ts';

const richResponseChartAspectRatio = '21 / 9';

export function RichResponseBarChart({ props }: { props: RichResponseBarChartProps }) {
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const legendItems = buildLegendItems(props);
    const margin = buildBarChartMargin(props);

    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <ChartFrame title={props.title}>
                <BarChart
                    aspectRatio={richResponseChartAspectRatio}
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
                />
            </ChartFrame>
        </ChartLegendHoverProvider>
    );
}

export function RichResponseLineChart({ props }: { props: RichResponseLineChartProps }) {
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const chartData = normalizeLineChartData(props);
    const legendItems = buildLegendItems(props);
    const margin = buildLineChartMargin(chartData, props.series);

    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <ChartFrame title={props.title}>
                <AreaChart
                    aspectRatio={richResponseChartAspectRatio}
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
                />
            </ChartFrame>
        </ChartLegendHoverProvider>
    );
}

export function RichResponseComposedChart({ props }: { props: RichResponseComposedChartProps }) {
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const chartSeries = buildComposedSeries(props);
    const chartData = normalizeLineChartData({ ...props, series: chartSeries });
    const legendItems = buildLegendItems({ ...props, series: chartSeries }, (_series, index) =>
        composedSeriesUnit(props, index)
    );
    const margin = buildComposedChartMargin(chartData, props);
    const barUnit = composedBarUnit(props);
    const lineUnit = composedLineUnit(props);

    return (
        <ChartLegendHoverProvider
            hoveredIndex={hoveredSeriesIndex}
            onHoverChange={setHoveredSeriesIndex}
        >
            <ChartFrame title={props.title}>
                <ComposedChart
                    aspectRatio={richResponseChartAspectRatio}
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
                                yAxisId="right"
                            />
                        );
                    })}
                    <YAxis
                        formatValue={(value) => formatChartValue(value, barUnit)}
                        yAxisId="left"
                    />
                    <YAxis
                        formatValue={(value) => formatChartValue(value, lineUnit)}
                        orientation="right"
                        yAxisId="right"
                    />
                    <XAxis />
                    <ChartTooltip
                        indicatorColor={seriesColor(0)}
                        rows={(point) =>
                            buildTooltipRows(chartSeries, point, (_series, index) =>
                                composedSeriesUnit(props, index)
                            )
                        }
                        showCrosshair={false}
                    />
                </ComposedChart>
                <ChartLegend
                    hoveredIndex={hoveredSeriesIndex}
                    items={legendItems}
                    onHoverChange={setHoveredSeriesIndex}
                />
            </ChartFrame>
        </ChartLegendHoverProvider>
    );
}

function ChartFrame({ children, title }: { children: ReactNode; title: string }) {
    return (
        <RichResponseFrame size="full" title={title}>
            <div className="min-w-0" style={chartStyleVars}>
                {children}
            </div>
        </RichResponseFrame>
    );
}
