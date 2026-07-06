import {
    Legend,
    LegendItem,
    LegendLabel,
    LegendMarker,
    LegendValue,
    useLegendItem,
} from '../components/charts/legend/index.ts';
import { type ChartLegendItemData, formatChartValue } from './chart-view-model.ts';

export function ChartLegend({
    hoveredIndex,
    items,
    onHoverChange,
}: {
    hoveredIndex: null | number;
    items: ChartLegendItemData[];
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
                <ChartLegendValue />
            </LegendItem>
        </Legend>
    );
}

function ChartLegendValue() {
    const { item } = useLegendItem();
    const unit = (item as ChartLegendItemData).unit;

    return (
        <LegendValue
            className="font-medium text-sm tabular-nums group-data-[hovered]:text-foreground"
            formatValue={(value) => formatChartValue(value, unit)}
        />
    );
}
