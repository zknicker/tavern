/**
 * Tavern component kit: the shared presentational library behind every
 * inline-UI surface (catalog widgets, plugin widgets, dashboards, sandboxed
 * agent pages). Kit components are props-in/render-out — no data fetching, no
 * tRPC, no app state — and consume global.css tokens only, so the module can
 * also compile into a standalone sandbox bundle. Bare-noun vocabulary:
 * `<Card title="Sales"><BarChart data={...} /></Card>`.
 */
export {
    CalendarDay,
    type CalendarDayEvent,
    type CalendarDayProps,
    CalendarEvent,
    type CalendarEventProps,
} from './calendar.tsx';
export { Card } from './card.tsx';
export { ChartLegend } from './chart-legend.tsx';
export { ChartStatus } from './chart-status.tsx';
export {
    type BarChartProps,
    type ChartDatum,
    type ChartLegendItemData,
    type ChartSeries,
    type ComposedChartProps,
    chartStyleVars,
    type LineChartProps,
} from './chart-view-model.ts';
export { BarChart, ComposedChart, LineChart } from './charts.tsx';
export { DateRangePicker } from './date-range-picker.tsx';
export {
    addDays,
    endOfMonth,
    formatDateRangeEndpoint,
    formatIsoDate,
    parseIsoDate,
    shiftIsoDate,
    startOfMonth,
} from './iso-date.ts';
export { Table, type TableColumn, type TableValue } from './table.tsx';
