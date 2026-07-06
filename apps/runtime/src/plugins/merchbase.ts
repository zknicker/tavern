import { createMerchbaseClient, type MerchbaseClient } from '@merchbase/http-client';
import {
    type AgentRuntimeMerchbaseActionInput,
    type AgentRuntimeMerchbaseActionResult,
    type AgentRuntimeMerchbaseSalesSeries,
    type AgentRuntimeMerchbaseSalesSeriesInput,
    type AgentRuntimeMerchbaseSettings,
    type AgentRuntimePlugin,
    type AgentRuntimeSaveMerchbaseSettings,
    agentRuntimeMerchbaseActionInputSchema,
    agentRuntimeMerchbaseActionResultSchema,
    agentRuntimeMerchbaseSalesSeriesInputSchema,
    agentRuntimeMerchbaseSalesSeriesSchema,
    agentRuntimeMerchbaseSettingsSchema,
    agentRuntimePluginSchema,
    agentRuntimeSaveMerchbaseSettingsSchema,
} from '@tavern/api';
import { merchbasePluginId } from '@tavern/api/plugins/merchbase';
import * as z from 'zod';
import type { RuntimeCapabilityCheckResult } from '../capabilities/definitions';
import { getGooglePlugin } from './google';
import {
    getPlugin,
    readPluginConfig,
    readPluginSecret,
    writePluginConfig,
    writePluginSecret,
} from './store';

const merchbaseProductionBaseUrl = 'https://app.merchbase.co';

const storedMerchbaseConfigSchema = z.object({
    baseUrl: z.string().trim().url().default(merchbaseProductionBaseUrl),
    defaultAccount: z.string().trim().min(1).max(160).nullable().default(null),
    defaultMarketplace: z.string().trim().min(1).max(40).nullable().default(null),
});

const storedMerchbaseSecretSchema = z.object({
    apiKey: z.string().trim().min(1).max(4096).optional(),
});

interface EffectiveMerchbaseSettings {
    apiKey: string | null;
    baseUrl: string;
    defaultAccount: string | null;
    defaultMarketplace: string | null;
    enabled: boolean;
    enablementSource: 'environment' | 'settings';
    updatedAt: string | null;
}

export function listRuntimePlugins(): AgentRuntimePlugin[] {
    return [getMerchbasePlugin(), getGooglePlugin()];
}

export function getMerchbasePlugin(): AgentRuntimePlugin {
    const stored = getPlugin(merchbasePluginId);
    const effective = resolveMerchbaseSettings();

    return agentRuntimePluginSchema.parse({
        ...stored,
        config: {
            baseUrl: effective.baseUrl,
            defaultAccount: effective.defaultAccount,
            defaultMarketplace: effective.defaultMarketplace,
        },
        enabled: effective.enabled,
        secrets: effective.apiKey ? [{ hasValue: true, name: 'apiKey' }] : [],
        updatedAt: effective.updatedAt,
    });
}

export function getMerchbaseSettings(): AgentRuntimeMerchbaseSettings {
    const effective = resolveMerchbaseSettings();
    return agentRuntimeMerchbaseSettingsSchema.parse({
        apiKey: effective.apiKey ?? '',
        apiKeyConfigured: Boolean(effective.apiKey),
        baseUrl: effective.baseUrl,
        defaultAccount: effective.defaultAccount,
        defaultMarketplace: effective.defaultMarketplace,
        enabled: effective.enabled,
        enablementSource: effective.enablementSource,
        skillConflict: null,
        updatedAt: effective.updatedAt,
    });
}

export function saveMerchbaseSettings(
    input: AgentRuntimeSaveMerchbaseSettings
): AgentRuntimeMerchbaseSettings {
    const parsed = agentRuntimeSaveMerchbaseSettingsSchema.parse(input);
    const current = resolveStoredMerchbaseSettings();
    const config = {
        baseUrl: parsed.baseUrl ?? current.config.baseUrl,
        defaultAccount:
            parsed.defaultAccount === undefined
                ? current.config.defaultAccount
                : parsed.defaultAccount,
        defaultMarketplace:
            parsed.defaultMarketplace === undefined
                ? current.config.defaultMarketplace
                : parsed.defaultMarketplace,
    };
    const enabled = parsed.enabled ?? current.enabled;
    const apiKey =
        parsed.apiKey === undefined ? (current.secret.apiKey ?? null) : parsed.apiKey || null;
    if (enabled && !apiKey) {
        throw new Error('Add a MerchBase API key before enabling MerchBase.');
    }
    writePluginConfig({ config, enabled, id: merchbasePluginId });

    if (parsed.apiKey !== undefined) {
        writePluginSecret({
            id: merchbasePluginId,
            secret: parsed.apiKey ? { apiKey: parsed.apiKey } : {},
        });
    }

    return getMerchbaseSettings();
}

export async function checkMerchbaseCapability(): Promise<RuntimeCapabilityCheckResult> {
    const settings = resolveMerchbaseSettings();
    if (!settings.enabled) {
        return {
            metadata: { baseUrl: settings.baseUrl },
            reason: 'MerchBase is disabled.',
            state: 'unavailable',
        };
    }
    if (!settings.apiKey) {
        return {
            metadata: { baseUrl: settings.baseUrl },
            reason: 'MerchBase needs an API key.',
            state: 'unauthorized',
        };
    }

    try {
        const account = await createConfiguredMerchbaseClient(settings).accounts.get.query();
        return {
            metadata: {
                accountId: account.accountId,
                baseUrl: settings.baseUrl,
                marketplace: account.marketplace,
            },
            state: 'healthy',
        };
    } catch (error) {
        return {
            metadata: { baseUrl: settings.baseUrl },
            reason: 'MerchBase is not reachable.',
            state: 'degraded',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function queryMerchbaseSalesSeries(
    input: AgentRuntimeMerchbaseSalesSeriesInput
): Promise<AgentRuntimeMerchbaseSalesSeries> {
    const parsed = agentRuntimeMerchbaseSalesSeriesInputSchema.parse(input);
    const settings = requireReadyMerchbaseSettings();
    const response = await createConfiguredMerchbaseClient(settings).sales.series.query({
        ...parsed,
        marketplace: parsed.marketplace ?? settings.defaultMarketplace ?? undefined,
    });

    return agentRuntimeMerchbaseSalesSeriesSchema.parse({
        ...response,
        query: parsed,
    });
}

export async function queryMerchbaseAction(
    input: AgentRuntimeMerchbaseActionInput
): Promise<AgentRuntimeMerchbaseActionResult> {
    const parsed = agentRuntimeMerchbaseActionInputSchema.parse(input);
    const settings = requireReadyMerchbaseSettings();
    const client = createConfiguredMerchbaseClient(settings);

    const result = await runMerchbaseAction({ client, input: parsed, settings });
    return agentRuntimeMerchbaseActionResultSchema.parse({
        action: parsed.action,
        result,
    });
}

async function runMerchbaseAction({
    client,
    input,
    settings,
}: {
    client: MerchbaseClient;
    input: z.output<typeof agentRuntimeMerchbaseActionInputSchema>;
    settings: EffectiveMerchbaseSettings;
}) {
    switch (input.action) {
        case 'accounts.get':
            return await client.accounts.get.query();
        case 'setup.status':
            return await client.setup.status.query();
        case 'merchAccount.get':
            return await client.merchAccount.get.query();
        case 'merchAccount.statusCounts.get':
            return await client.merchAccount.statusCounts.get.query();
        case 'products.list':
            return await client.products.list.query(withDefaultMarketplace(input.input, settings));
        case 'products.search':
            return await client.products.search.query(
                withDefaultMarketplace(input.input, settings)
            );
        case 'products.get':
            return await client.products.get.query(withRequiredMarketplace(input.input, settings));
        case 'products.metadata':
            return await client.products.metadata.query(
                withDefaultMarketplace(input.input, settings)
            );
        case 'products.catalog.get':
            return await client.products.catalog.get.query();
        case 'products.catalog.options':
            return await client.products.catalog.options.query(input.input);
        case 'products.catalog.product':
            return await client.products.catalog.product.query(input.input);
        case 'designs.list':
            return await client.designs.list.query(input.input);
        case 'designs.get':
            return await client.designs.get.query(input.input);
        case 'designs.facets.get':
            return await client.designs.facets.get.query(input.input);
        case 'designs.facets.status':
            return await client.designs.facets.status.query(input.input);
        case 'sales.summary':
            return await client.sales.summary.query(withDefaultMarketplace(input.input, settings));
        case 'sales.records':
            return await client.sales.records.query(withDefaultMarketplace(input.input, settings));
        case 'sales.series':
            return await queryMerchbaseSalesSeries(input.input);
        case 'sales.breakdown':
            return await client.sales.breakdown.query(
                withDefaultMarketplace(input.input, settings)
            );
    }
}

function createConfiguredMerchbaseClient(settings: EffectiveMerchbaseSettings): MerchbaseClient {
    return createMerchbaseClient({
        apiKey: settings.apiKey ?? undefined,
        baseUrl: settings.baseUrl,
        headers: {
            ...(settings.defaultAccount ? { 'x-merchbase-account': settings.defaultAccount } : {}),
            ...(settings.defaultMarketplace
                ? { 'x-merchbase-marketplace': settings.defaultMarketplace }
                : {}),
        },
    });
}

function requireReadyMerchbaseSettings(): EffectiveMerchbaseSettings {
    const settings = resolveMerchbaseSettings();
    if (!settings.enabled) {
        throw new Error('MerchBase is disabled.');
    }
    if (!settings.apiKey) {
        throw new Error('MerchBase needs an API key.');
    }
    return settings;
}

function withDefaultMarketplace<TInput extends { marketplace?: string }>(
    input: TInput,
    settings: EffectiveMerchbaseSettings
): TInput {
    return {
        ...input,
        marketplace: input.marketplace ?? settings.defaultMarketplace ?? undefined,
    };
}

function withRequiredMarketplace<TInput extends { marketplace?: string }>(
    input: TInput,
    settings: EffectiveMerchbaseSettings
): Omit<TInput, 'marketplace'> & { marketplace: string } {
    const marketplace = input.marketplace ?? settings.defaultMarketplace;
    if (!marketplace) {
        throw new Error('MerchBase marketplace is required.');
    }
    return {
        ...input,
        marketplace,
    };
}

function resolveMerchbaseSettings(): EffectiveMerchbaseSettings {
    const stored = resolveStoredMerchbaseSettings();
    return {
        apiKey: stored.secret.apiKey ?? null,
        baseUrl: stored.config.baseUrl,
        defaultAccount: stored.config.defaultAccount,
        defaultMarketplace: stored.config.defaultMarketplace,
        enabled: stored.enabled,
        enablementSource: 'settings',
        updatedAt: stored.updatedAt,
    };
}

function resolveStoredMerchbaseSettings() {
    const plugin = getPlugin(merchbasePluginId);
    return {
        config: readPluginConfig(merchbasePluginId, storedMerchbaseConfigSchema),
        enabled: plugin.enabled,
        secret: readPluginSecret(merchbasePluginId, storedMerchbaseSecretSchema) ?? {},
        updatedAt: plugin.updatedAt,
    };
}
