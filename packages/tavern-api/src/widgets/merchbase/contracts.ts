import * as z from 'zod';
import type { WidgetPromptEntry } from '../prompt.ts';

const merchBaseIsoDateSchema = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/u);
const merchBaseFilterSchema = z.string().trim().min(1).max(160).optional();

export const widgetMerchBaseSalesChartPropsSchema = z
    .object({
        asin: merchBaseFilterSchema,
        color: merchBaseFilterSchema,
        endDate: merchBaseIsoDateSchema.optional(),
        facet: merchBaseFilterSchema,
        facetName: merchBaseFilterSchema,
        fit: merchBaseFilterSchema,
        marketplace: merchBaseFilterSchema,
        productType: merchBaseFilterSchema,
        rangeDays: z.number().int().min(1).max(90).default(10),
        title: z.string().trim().min(1).max(160).default('MerchBase sales'),
    })
    .strict();

export type WidgetMerchBaseSalesChartProps = z.infer<typeof widgetMerchBaseSalesChartPropsSchema>;

/**
 * Plugin-owned prompt entry. Lives beside the schema so the MerchBase Plugin
 * owns both its data contract and the guidance the agent sees; the runtime
 * gates it into the prompt only when the Plugin is enabled and granted.
 */
export const widgetMerchBaseSalesChartPromptEntry: WidgetPromptEntry = {
    description:
        'Preferred way to present MerchBase sales trends over a date range. Fetches live MerchBase sales, renders sales as bars and royalties as a line, includes a date range selector, and shows hover-driven sold/cancelled/returned/royalties stats for the active day. Missing days in the range render as zero-sales buckets, including the current endDate.',
    signature:
        '{"title"?:string,"endDate"?:"YYYY-MM-DD","rangeDays"?:number,"asin"?:string,"color"?:string,"facet"?:string,"facetName"?:string,"fit"?:string,"marketplace"?:string,"productType"?:string}',
    constraints:
        'Default to the 10-day trend for today/current sales requests; omit rangeDays or use 10 unless the user explicitly asks for a one-day chart. Use endDate to anchor the active day.',
};
