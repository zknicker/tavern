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
import { useState } from 'react';
import { Area, AreaChart } from '../components/charts/area-chart.tsx';
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
import { ChartTooltip } from '../components/charts/tooltip/index.ts';
import { XAxis } from '../components/charts/x-axis.tsx';
import { YAxis } from '../components/charts/y-axis.tsx';
import { Icon } from '../components/ui/icon.tsx';
import { Button } from '../components/ui/primitives/button.tsx';
import { WidgetFrame } from '../components/widgets/widget-frame.tsx';
import {
    buildBarChartMargin,
    buildLegendItems,
    buildLineChartMargin,
    buildTooltipRows,
    chartStyleVars,
    formatChartValue,
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

    return null;
}

function TavernBarChart({ props }: { props: TavernRenderBarChartProps }) {
    const [expanded, setExpanded] = useState(false);
    const [hoveredSeriesIndex, setHoveredSeriesIndex] = useState<null | number>(null);
    const toggleLabel = expanded ? 'Collapse chart' : 'Expand chart';
    const legendItems = buildLegendItems(props);
    const margin = buildBarChartMargin(props);

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
                            rows={(point) => buildTooltipRows(props.series, point, props.unit)}
                        />
                    </AreaChart>
                    <ChartLegend
                        hoveredIndex={hoveredSeriesIndex}
                        items={legendItems}
                        onHoverChange={setHoveredSeriesIndex}
                        unit={props.unit}
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
    unit,
}: {
    hoveredIndex: null | number;
    items: LegendItemData[];
    onHoverChange: (index: null | number) => void;
    unit?: string;
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
                <LegendValue
                    className="font-medium text-sm tabular-nums group-data-[hovered]:text-foreground"
                    formatValue={(value) => formatChartValue(value, unit)}
                />
            </LegendItem>
        </Legend>
    );
}
