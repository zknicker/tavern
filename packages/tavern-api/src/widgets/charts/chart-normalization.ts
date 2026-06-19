import type * as z from 'zod';

type ChartDatum = Record<string, string | number | boolean | null>;

interface ChartSeries {
    key: string;
    label: string;
}

interface ChartProps {
    data: ChartDatum[];
    series: ChartSeries[];
    title: string;
    unit?: string;
    xKey: string;
}

interface ChartToolInput {
    data: ChartDatum[];
    title: string;
    unit?: string;
    x: string;
    y: string | string[];
}

interface ComposedChartProps {
    barSeries: ChartSeries[];
    data: ChartDatum[];
    lineSeries: ChartSeries[];
    title: string;
    unit?: string;
    xKey: string;
}

interface ComposedChartToolInput {
    barY: string | string[];
    data: ChartDatum[];
    lineY: string | string[];
    title: string;
    unit?: string;
    x: string;
}

const numericStringPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

export function validateStoredChartProps(
    props: ChartProps,
    context: z.RefinementCtx,
    options: { allowNegative: boolean; valueMessage: string }
) {
    const keys = new Set(props.series.map((series) => series.key));

    if (keys.size !== props.series.length) {
        context.addIssue({
            code: 'custom',
            message: 'Series keys must be unique.',
            path: ['series'],
        });
    }

    for (const [rowIndex, row] of props.data.entries()) {
        const xValue = row[props.xKey];

        if (!(typeof xValue === 'string' || typeof xValue === 'number')) {
            context.addIssue({
                code: 'custom',
                message: 'Each data row needs a string or number x value.',
                path: ['data', rowIndex, props.xKey],
            });
        }

        for (const [seriesIndex, series] of props.series.entries()) {
            const value = row[series.key];

            if (
                !(
                    typeof value === 'number' &&
                    Number.isFinite(value) &&
                    (options.allowNegative || value >= 0)
                )
            ) {
                context.addIssue({
                    code: 'custom',
                    message: options.valueMessage,
                    path: ['data', rowIndex, props.series[seriesIndex]?.key ?? series.key],
                });
            }
        }
    }
}

export function validateToolChartInput(
    input: ChartToolInput,
    context: z.RefinementCtx,
    options: { allowNegative: boolean; valueMessage: string }
) {
    const yKeys = chartYKeys(input.y);
    const keys = new Set(yKeys);

    if (keys.size !== yKeys.length) {
        context.addIssue({
            code: 'custom',
            message: 'Y keys must be unique.',
            path: ['y'],
        });
    }

    validateToolChartRows(input, yKeys, context, options);
}

export function normalizeToolChartInput(
    input: ChartToolInput,
    options: { allowNegative: boolean }
) {
    const yKeys = chartYKeys(input.y);
    const normalized = {
        data: normalizeRows(input.data, yKeys, options),
        series: yKeys.map((key) => ({ key, label: chartLabelFromKey(key) })),
        title: input.title,
        xKey: input.x,
    };

    return input.unit ? { ...normalized, unit: input.unit } : normalized;
}

export function validateToolComposedChartInput(
    input: ComposedChartToolInput,
    context: z.RefinementCtx
) {
    const barKeys = chartYKeys(input.barY);
    const lineKeys = chartYKeys(input.lineY);
    const allKeys = [...barKeys, ...lineKeys];

    validateComposedSeriesCount(allKeys, context);

    const keys = new Set(allKeys);
    if (keys.size !== allKeys.length) {
        context.addIssue({
            code: 'custom',
            message: 'Composed chart y keys must be unique.',
            path: ['lineY'],
        });
    }

    validateToolChartRows({ ...input, y: allKeys }, allKeys, context, {
        allowNegative: false,
        valueMessage:
            'Composed chart y values must be finite nonnegative numbers or numeric strings.',
    });
}

export function normalizeToolComposedChartInput(input: ComposedChartToolInput) {
    const barKeys = chartYKeys(input.barY);
    const lineKeys = chartYKeys(input.lineY);
    const allKeys = [...barKeys, ...lineKeys];
    const normalized = {
        barSeries: barKeys.map((key) => ({ key, label: chartLabelFromKey(key) })),
        data: normalizeRows(input.data, allKeys, { allowNegative: false }),
        lineSeries: lineKeys.map((key) => ({ key, label: chartLabelFromKey(key) })),
        title: input.title,
        xKey: input.x,
    };

    return input.unit ? { ...normalized, unit: input.unit } : normalized;
}

export function composedSeries(props: ComposedChartProps) {
    return [...props.barSeries, ...props.lineSeries];
}

export function validateComposedStoredSeriesCount(
    props: ComposedChartProps,
    context: z.RefinementCtx
) {
    validateComposedSeriesCount(
        composedSeries(props).map((series) => series.key),
        context
    );
}

function validateToolChartRows(
    input: ChartToolInput,
    yKeys: string[],
    context: z.RefinementCtx,
    options: { allowNegative: boolean; valueMessage: string }
) {
    for (const [rowIndex, row] of input.data.entries()) {
        const xValue = row[input.x];

        if (!(typeof xValue === 'string' || typeof xValue === 'number')) {
            context.addIssue({
                code: 'custom',
                message: 'Each data row needs a string or number x value.',
                path: ['data', rowIndex, input.x],
            });
        }

        for (const key of yKeys) {
            const value = chartNumberFromValue(row[key], { allowNegative: options.allowNegative });

            if (value === null) {
                context.addIssue({
                    code: 'custom',
                    message: options.valueMessage,
                    path: ['data', rowIndex, key],
                });
            }
        }
    }
}

function normalizeRows(data: ChartDatum[], yKeys: string[], options: { allowNegative: boolean }) {
    return data.map((row) => {
        const next = { ...row };

        for (const key of yKeys) {
            const value = chartNumberFromValue(row[key], options);
            if (value !== null) {
                next[key] = value;
            }
        }

        return next;
    });
}

function chartYKeys(value: string | string[]) {
    return Array.isArray(value) ? value : [value];
}

function chartLabelFromKey(key: string) {
    const words = key
        .replace(/[_-]+/gu, ' ')
        .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
        .trim();

    return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

function validateComposedSeriesCount(series: string[], context: z.RefinementCtx) {
    if (series.length > 4) {
        context.addIssue({
            code: 'custom',
            message: 'Composed charts support up to 4 total series.',
            path: ['lineSeries'],
        });
    }
}

function chartNumberFromValue(value: unknown, options: { allowNegative?: boolean } = {}) {
    if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (options.allowNegative || value >= 0)
    ) {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    if (!numericStringPattern.test(trimmed)) {
        return null;
    }

    const numericValue = Number(trimmed);

    return Number.isFinite(numericValue) && (options.allowNegative || numericValue >= 0)
        ? numericValue
        : null;
}
