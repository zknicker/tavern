import { expect, test } from "vitest";
import { resolveInitialChartPhase } from "./use-chart-phase-orchestrator";

test("ready charts with enter animation mount in the reveal phase", () => {
  expect(
    resolveInitialChartPhase({
      animationDuration: 1100,
      chartStatus: "ready",
      skipEnterReveal: false,
    })
  ).toBe("revealing");
});

test("static ready previews mount in the ready phase", () => {
  expect(
    resolveInitialChartPhase({
      animationDuration: 1100,
      chartStatus: "ready",
      skipEnterReveal: true,
    })
  ).toBe("ready");
});

test("ready charts without animation mount in the ready phase", () => {
  expect(
    resolveInitialChartPhase({
      animationDuration: 0,
      chartStatus: "ready",
      skipEnterReveal: false,
    })
  ).toBe("ready");
});
