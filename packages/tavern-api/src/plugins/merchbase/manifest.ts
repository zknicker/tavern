import type { AgentRuntimeCapabilityHealthId } from '../../runtime/contracts.ts';
import { tavernPluginManifestSchema } from '../contracts.ts';

export const merchbasePluginId = 'merchbase' as const;

export const merchbasePluginHealthCapabilityId =
    'plugin.merchbase' satisfies AgentRuntimeCapabilityHealthId;

/**
 * Plugin-owned prompt guidance for the MerchBase sales series tool. Lives
 * beside the manifest so the MerchBase Plugin owns both its data contract and
 * the guidance the agent sees; the runtime gates it into the prompt only when
 * the Plugin is enabled and granted (the same gate as the Plugin's tools).
 */
export const merchbaseSalesSeriesToolPromptEntry = `## MerchBase

When someone asks about MerchBase sales, fetch live data with \`merchbase_sales_series\` — a range like "30d" or "2026-06-01..2026-06-30", a day/week/month bucket, and optional product filters (asin, color, facet, facetName, fit, marketplace, productType) — then present the result. Daily rows include explicit zero-sales days: a zero means no sales, not missing data.`;

export const merchbasePluginManifest = tavernPluginManifestSchema.parse({
    description: 'Analyze Amazon Merch sales and product data from MerchBase.',
    displayName: 'MerchBase',
    healthCapabilities: [],
    id: merchbasePluginId,
    secrets: [{ name: 'apiKey' }],
    services: [
        {
            defaultEnabled: true,
            description: 'Read-only MerchBase sales, product, catalog, and design tools.',
            displayName: 'MerchBase',
            healthCapabilities: [merchbasePluginHealthCapabilityId],
            id: 'merchbase',
            scopes: [],
            skillGuidance: `## Sales chart widget

\`widget:merchbase-sales-chart\` is the preferred way to present MerchBase sales trends over a date range. It fetches live MerchBase sales, renders sales as bars and royalties as a line, includes a date range selector, and shows hover-driven sold/cancelled/returned/royalties stats for the active day. Missing days in the range render as zero-sales buckets, including the current endDate.

\`\`\`widget:merchbase-sales-chart
{"title"?:string,"endDate"?:"YYYY-MM-DD","rangeDays"?:number,"asin"?:string,"color"?:string,"facet"?:string,"facetName"?:string,"fit"?:string,"marketplace"?:string,"productType"?:string}
\`\`\`

Default to the 10-day trend for today/current sales requests; omit rangeDays or use 10 unless the user explicitly asks for a one-day chart. Use endDate to anchor the active day. The fence body must be one valid JSON object (the signature above shows prop types, not literal JSON).`,
            skills: [{ name: 'merchbase', runtimeSource: 'tavern-plugin:merchbase' }],
            toolGroups: [
                {
                    description: 'Read-only MerchBase sales, product, catalog, and design tools.',
                    id: 'merchbase',
                    label: 'MerchBase',
                    tools: [
                        'merchbase_status',
                        'merchbase_sales_summary',
                        'merchbase_sales_records',
                        'merchbase_sales_series',
                        'merchbase_sales_breakdown',
                        'merchbase_products_list',
                        'merchbase_products_search',
                        'merchbase_products_get',
                        'merchbase_products_metadata',
                        'merchbase_product_catalog',
                        'merchbase_product_catalog_options',
                        'merchbase_product_catalog_product',
                        'merchbase_designs_list',
                        'merchbase_designs_get',
                        'merchbase_design_facets_get',
                    ],
                },
            ],
        },
    ],
    settings: ['baseUrl', 'defaultAccount', 'defaultMarketplace'],
    version: '1.0.0',
    widgets: [{ name: 'merchbase-sales-chart' }],
});
