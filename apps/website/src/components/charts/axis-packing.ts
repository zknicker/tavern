import type { Margin } from "./chart-context";

type AxisSide = "left" | "right";

export interface PackedYAxisInput {
  side: AxisSide;
  keys: string[];
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
}

export interface PackedChartMarginInput {
  base: Margin;
  data: Record<string, unknown>[];
  emptySideMargin?: Partial<Record<AxisSide, number>>;
  yAxes: PackedYAxisInput[];
}

const DEFAULT_MAX_AXIS_MARGIN = 52;
const DEFAULT_MIN_AXIS_MARGIN = 30;
const LABEL_GUTTER_WIDTH = 16;
const LABEL_WIDTH_PER_CHARACTER = 7;

export function buildPackedChartMargin({
  base,
  data,
  emptySideMargin,
  yAxes,
}: PackedChartMarginInput): Margin {
  return {
    ...base,
    left: packedSideMargin("left", { base, data, emptySideMargin, yAxes }),
    right: packedSideMargin("right", { base, data, emptySideMargin, yAxes }),
  };
}

export function estimatePackedYAxisMargin(
  data: Record<string, unknown>[],
  axis: PackedYAxisInput
) {
  const values = data.flatMap((point) =>
    axis.keys.flatMap((key) => {
      const value = point[key];
      return typeof value === "number" && Number.isFinite(value) ? [value] : [];
    })
  );
  const minMargin = axis.min ?? DEFAULT_MIN_AXIS_MARGIN;
  const maxMargin = axis.max ?? DEFAULT_MAX_AXIS_MARGIN;

  if (values.length === 0) {
    return minMargin;
  }

  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const padding = Math.max((max - min) * 0.1, 1);
  const paddedMin = min < 0 ? min - padding : min;
  const paddedMax = max + padding;
  const formatter = axis.formatValue ?? defaultPackedAxisValueFormatter;
  const labels = [paddedMin, min, 0, max, paddedMax].map(formatter);
  const longestLabelLength = Math.max(...labels.map((label) => label.length));
  const estimatedWidth =
    longestLabelLength * LABEL_WIDTH_PER_CHARACTER + LABEL_GUTTER_WIDTH;

  return clampNumber(Math.ceil(estimatedWidth), minMargin, maxMargin);
}

export function defaultPackedAxisValueFormatter(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(Math.abs(value) < 10 ? 1 : 0);
}

function packedSideMargin(
  side: AxisSide,
  input: PackedChartMarginInput
): number {
  const margins = input.yAxes
    .filter((axis) => axis.side === side && axis.keys.length > 0)
    .map((axis) => estimatePackedYAxisMargin(input.data, axis));

  if (margins.length === 0) {
    return input.emptySideMargin?.[side] ?? input.base[side];
  }

  return Math.max(...margins);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
