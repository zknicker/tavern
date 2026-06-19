import assert from 'node:assert/strict';
import test from 'node:test';
import {
    computeSeriesBarWidth,
    computeSeriesBarXScalePadding,
} from './series-bar-layout.ts';

test('composed bar x-scale padding keeps first and last bars inside the plot', () => {
    const innerWidth = 720;
    const dataLength = 6;
    const composedMaxBarSize = 52;
    const padding = computeSeriesBarXScalePadding({
        composedMaxBarSize,
        dataLength,
        innerWidth,
        seriesCount: 1,
    });
    const columnWidth = (innerWidth - padding * 2) / (dataLength - 1);
    const barWidth = computeSeriesBarWidth({
        columnWidth,
        composedMaxBarSize,
        dataLength,
        innerWidth,
        seriesCount: 1,
    });

    assert.ok(padding > 0);
    assert.ok(padding - barWidth / 2 >= 0);
    assert.ok(innerWidth - padding + barWidth / 2 <= innerWidth);
});

test('composed bar x-scale padding accounts for grouped series', () => {
    const padding = computeSeriesBarXScalePadding({
        composedBarGap: 6,
        composedMaxBarSize: 42,
        dataLength: 6,
        innerWidth: 720,
        seriesCount: 2,
    });

    assert.equal(padding, 45);
});
