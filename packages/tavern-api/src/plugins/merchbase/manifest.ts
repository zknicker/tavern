import { richResponseMerchBaseSalesChartComponentType } from '../../rich-responses/merchbase/contracts.ts';
import type { AgentRuntimeCapabilityHealthId } from '../../runtime/contracts.ts';
import { tavernPluginManifestSchema } from '../contracts.ts';

export const merchbasePluginId = 'merchbase' as const;

export const merchbasePluginHealthCapabilityId =
    'plugin.merchbase' satisfies AgentRuntimeCapabilityHealthId;

export const merchbasePluginManifest = tavernPluginManifestSchema.parse({
    description: 'Analyze Amazon Merch sales and product data from MerchBase.',
    displayName: 'MerchBase',
    healthCapabilities: [merchbasePluginHealthCapabilityId],
    id: merchbasePluginId,
    richResponseComponents: [{ type: richResponseMerchBaseSalesChartComponentType }],
    secrets: [{ name: 'apiKey' }],
    settings: ['baseUrl', 'defaultAccount', 'defaultMarketplace'],
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
    version: '1.0.0',
});
