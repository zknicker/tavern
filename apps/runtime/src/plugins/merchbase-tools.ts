import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeAgent, AgentRuntimeMerchbaseActionInput } from '@tavern/api';
import { merchbasePluginId } from '@tavern/api/plugins/merchbase';
import { tool } from 'ai';
import * as z from 'zod';
import { getMerchbasePlugin, queryMerchbaseAction } from './merchbase.ts';

const merchbaseToolInputSchema = z.object({}).passthrough().default({});

const merchbaseTools = [
    ['merchbase_status', 'accounts.get', 'Read the configured MerchBase account and marketplace.'],
    ['merchbase_sales_summary', 'sales.summary', 'Read MerchBase sales totals for a date range.'],
    ['merchbase_sales_records', 'sales.records', 'List MerchBase sales records.'],
    ['merchbase_sales_series', 'sales.series', 'Read MerchBase daily sales and royalty series.'],
    [
        'merchbase_sales_breakdown',
        'sales.breakdown',
        'Group MerchBase sales by product, marketplace, or facet.',
    ],
    ['merchbase_products_list', 'products.list', 'List MerchBase products.'],
    ['merchbase_products_search', 'products.search', 'Search MerchBase products.'],
    [
        'merchbase_products_get',
        'products.get',
        'Read one MerchBase product by ASIN and marketplace.',
    ],
    ['merchbase_products_metadata', 'products.metadata', 'Read MerchBase product metadata facets.'],
    ['merchbase_product_catalog', 'products.catalog.get', 'Read the MerchBase product catalog.'],
    [
        'merchbase_product_catalog_options',
        'products.catalog.options',
        'Read MerchBase product catalog options.',
    ],
    [
        'merchbase_product_catalog_product',
        'products.catalog.product',
        'Read one MerchBase product catalog entry.',
    ],
    ['merchbase_designs_list', 'designs.list', 'List MerchBase designs.'],
    ['merchbase_designs_get', 'designs.get', 'Read one MerchBase design.'],
    ['merchbase_design_facets_get', 'designs.facets.get', 'Read MerchBase design facets.'],
] as const satisfies ReadonlyArray<
    readonly [string, AgentRuntimeMerchbaseActionInput['action'], string]
>;

export function createMerchbaseToolsForAgent(agent: AgentRuntimeAgent): ToolSet {
    if (
        !(
            (agent.enabledPluginIds ?? []).includes(merchbasePluginId) &&
            getMerchbasePlugin().enabled
        )
    ) {
        return {};
    }

    return Object.fromEntries(
        merchbaseTools.map(([name, action, description]) => [
            name,
            tool({
                description,
                inputSchema: merchbaseToolInputSchema,
                execute: async (input) => await executeMerchbaseTool(action, input),
            }),
        ])
    );
}

async function executeMerchbaseTool(
    action: AgentRuntimeMerchbaseActionInput['action'],
    input: Record<string, unknown>
) {
    try {
        return await queryMerchbaseAction({ action, input } as AgentRuntimeMerchbaseActionInput);
    } catch (error) {
        return {
            action,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
