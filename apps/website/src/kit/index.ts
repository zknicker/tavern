/**
 * Tavern component kit: the shared presentational library behind every
 * inline-UI surface (catalog widgets, plugin widgets, dashboards, sandboxed
 * agent pages). Kit components are props-in/render-out — no data fetching, no
 * tRPC, no app state — and consume global.css tokens only, so the module can
 * also compile into a standalone sandbox bundle.
 */
export {
    KitCalendarDay,
    type KitCalendarDayEvent,
    type KitCalendarDayProps,
    KitCalendarEvent,
    type KitCalendarEventProps,
} from './calendar.tsx';
export { KitChartLegend } from './chart-legend.tsx';
export { KitChartStatus } from './chart-status.tsx';
export {
    chartStyleVars,
    type KitBarChartProps,
    type KitChartDatum,
    type KitChartLegendItemData,
    type KitChartSeries,
    type KitComposedChartProps,
    type KitLineChartProps,
} from './chart-view-model.ts';
export { KitBarChart, KitComposedChart, KitComposedChartBody, KitLineChart } from './charts.tsx';
export { KitDateRangeSelector } from './date-range-selector.tsx';
export { KitFrame } from './frame.tsx';
export {
    addDays,
    endOfMonth,
    formatDateRangeEndpoint,
    formatIsoDate,
    parseIsoDate,
    shiftIsoDate,
    startOfMonth,
} from './iso-date.ts';
export { KitTable, type KitTableColumn, type KitTableValue } from './table.tsx';
