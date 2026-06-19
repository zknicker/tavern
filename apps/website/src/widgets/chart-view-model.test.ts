import { expect, test } from 'bun:test';
import {
    buildLegendItems,
    buildTooltipRows,
    composedSeriesUnit,
    formatChartValue,
} from './chart-view-model.ts';

test('formats composed chart legend and tooltip values with split units', () => {
    const props = {
        barSeries: [{ key: 'units', label: 'Units' }],
        barUnit: 'units',
        data: [{ month: '2026-06-01', royalties: 54.91, units: 19 }],
        lineSeries: [{ key: 'royalties', label: 'Royalties' }],
        lineUnit: 'USD',
        title: 'Units and Royalties',
        xKey: 'month',
    };
    const series = [...props.barSeries, ...props.lineSeries];

    const legendItems = buildLegendItems({ ...props, series }, (_series, index) =>
        composedSeriesUnit(props, index)
    );
    const tooltipRows = buildTooltipRows(series, props.data[0], (_series, index) =>
        composedSeriesUnit(props, index)
    );

    expect(
        legendItems.map((item) => ({
            label: item.label,
            value: formatChartValue(item.value, item.unit),
        }))
    ).toEqual([
        { label: 'Units', value: '19 units' },
        { label: 'Royalties', value: '$54.91' },
    ]);
    expect(tooltipRows).toEqual([
        { color: 'var(--chart-line-primary)', label: 'Units', value: '19 units' },
        { color: 'var(--chart-line-secondary)', label: 'Royalties', value: '$54.91' },
    ]);
});
