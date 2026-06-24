import * as z from 'zod';

export const richResponseMerchBaseSalesChartComponentType = 'MerchBaseSalesChart' as const;

const merchBaseIsoDateSchema = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/u);
const merchBaseFilterSchema = z.string().trim().min(1).max(160).optional();

export const richResponseMerchBaseSalesChartPropsSchema = z
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

export type RichResponseMerchBaseSalesChartProps = z.infer<
    typeof richResponseMerchBaseSalesChartPropsSchema
>;
