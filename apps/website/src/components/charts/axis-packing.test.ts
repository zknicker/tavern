import { describe, expect, test } from "bun:test";
import {
  buildPackedChartMargin,
  estimatePackedYAxisMargin,
} from "./axis-packing";

describe("axis packing", () => {
  test("keeps compact numeric axes at their minimum gutter", () => {
    expect(
      estimatePackedYAxisMargin([{ value: 4 }], {
        keys: ["value"],
        min: 30,
        side: "left",
      })
    ).toBe(30);
  });

  test("grows and clamps gutters for wider labels", () => {
    expect(
      estimatePackedYAxisMargin([{ value: 12_345_678 }], {
        keys: ["value"],
        max: 48,
        min: 30,
        side: "left",
      })
    ).toBe(48);
  });

  test("preserves caller-owned top and bottom spacing", () => {
    expect(
      buildPackedChartMargin({
        base: { bottom: 44, left: 30, right: 18, top: 24 },
        data: [{ revenue: 12_000 }],
        emptySideMargin: { right: 18 },
        yAxes: [{ keys: ["revenue"], max: 48, min: 30, side: "left" }],
      })
    ).toEqual({ bottom: 44, left: 37, right: 18, top: 24 });
  });
});
