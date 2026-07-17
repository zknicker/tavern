import type { ToolSet } from '@ai-sdk/provider-utils';
import type {
    AgentRuntimeAgent,
    AgentRuntimeMerchbaseActionInput,
    AgentRuntimeMerchbaseSalesSeriesInput,
} from '@tavern/api';
import { agentRuntimeMerchbaseSalesSeriesInputSchema } from '@tavern/api';
import { merchbasePluginId } from '@tavern/api/plugins/merchbase';
import { tool } from 'ai';
import * as z from 'zod';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import {
    getMerchbasePlugin,
    queryMerchbaseAction,
    queryMerchbaseSalesSeries,
} from './merchbase.ts';
import { shapeMerchbaseSalesSeriesForModel, todayIsoInTimezone } from './merchbase-sales-series.ts';

const merchbaseToolInputSchema = z.object({}).passthrough().default({});

const merchbaseTools = [
    ['merchbase_status', 'accounts.get', 'Read the configured MerchBase account and marketplace.'],
    ['merchbase_sales_summary', 'sales.summary', 'Read MerchBase sales totals for a date range.'],
    ['merchbase_sales_records', 'sales.records', 'List MerchBase sales records.'],
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

/**
 * The MerchBase tool gate: the agent holds the Plugin grant and the Plugin is
 * enabled. The prompt guidance for these tools uses the same gate.
 */
export function merchbaseToolsGrantedForAgent(agent: AgentRuntimeAgent | null = null): boolean {
    return Boolean(
        agent &&
            (agent.enabledPluginIds ?? []).includes(merchbasePluginId) &&
            getMerchbasePlugin().enabled
    );
}

export function createMerchbaseToolsForAgent(agent: AgentRuntimeAgent): ToolSet {
    if (!merchbaseToolsGrantedForAgent(agent)) {
        return {};
    }

    return {
        ...Object.fromEntries(
            merchbaseTools.map(([name, action, description]) => [
                name,
                tool({
                    description,
                    inputSchema: merchbaseToolInputSchema,
                    execute: async (input) => await executeMerchbaseTool(action, input),
                }),
            ])
        ),
        merchbase_sales_series: tool({
            description:
                'Read MerchBase sales as a bucketed series with totals. Rows are ISO-dated; daily ranges include explicit zero-sales days. Range accepts "30d" or "YYYY-MM-DD..YYYY-MM-DD".',
            inputSchema: agentRuntimeMerchbaseSalesSeriesInputSchema,
            execute: async (input) => await executeMerchbaseSalesSeriesTool(input),
        }),
    };
}

async function executeMerchbaseSalesSeriesTool(input: AgentRuntimeMerchbaseSalesSeriesInput) {
    try {
        const series = await queryMerchbaseSalesSeries(input);
        return shapeMerchbaseSalesSeriesForModel(series, {
            today: todayIsoInTimezone(resolveHomeTimezone()),
        });
    } catch (error) {
        return {
            action: 'sales.series',
            error: error instanceof Error ? error.message : String(error),
        };
    }
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
