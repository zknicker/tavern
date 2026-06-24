import {
    createMerchbaseClient,
    DEFAULT_API_BASE_URL,
    type MerchbaseClient,
} from '@merchbase/http-client';
import {
    type AgentRuntimeIntegration,
    type AgentRuntimeMerchbaseActionInput,
    type AgentRuntimeMerchbaseActionResult,
    type AgentRuntimeMerchbaseSalesSeries,
    type AgentRuntimeMerchbaseSalesSeriesInput,
    type AgentRuntimeMerchbaseSettings,
    type AgentRuntimeSaveMerchbaseSettings,
    agentRuntimeIntegrationSchema,
    agentRuntimeMerchbaseActionInputSchema,
    agentRuntimeMerchbaseActionResultSchema,
    agentRuntimeMerchbaseSalesSeriesInputSchema,
    agentRuntimeMerchbaseSalesSeriesSchema,
    agentRuntimeMerchbaseSettingsSchema,
    agentRuntimeSaveMerchbaseSettingsSchema,
} from '@tavern/api';
import * as z from 'zod';
import type { RuntimeCapabilityCheckResult } from '../capabilities/definitions';
import { HERMES_HOME, readConfigValue, resolveConfiguredPath } from '../config';
import { createLocalHermesClient } from '../hermes/local-client';
import {
    ensureManagedMerchbaseSkill,
    getMerchbaseSkillConflict,
    isManagedMerchbaseSkillInstalled,
} from '../hermes/merchbase-skill';
import {
    getIntegration,
    readIntegrationConfig,
    readIntegrationSecret,
    writeIntegrationConfig,
    writeIntegrationSecret,
} from './store';

const integrationId = 'merchbase' as const;

const storedMerchbaseConfigSchema = z.object({
    baseUrl: z.string().trim().url().default(DEFAULT_API_BASE_URL),
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
    updatedAt: string | null;
}

export function listRuntimeIntegrations(): AgentRuntimeIntegration[] {
    return [getMerchbaseIntegration()];
}

export function getMerchbaseIntegration(): AgentRuntimeIntegration {
    const stored = getIntegration(integrationId);
    const effective = resolveMerchbaseSettings();

    return agentRuntimeIntegrationSchema.parse({
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
        apiKeyConfigured: Boolean(effective.apiKey),
        baseUrl: effective.baseUrl,
        defaultAccount: effective.defaultAccount,
        defaultMarketplace: effective.defaultMarketplace,
        enabled: effective.enabled,
        skillConflict: getMerchbaseSkillConflict({ hermesHome: resolveEffectiveHermesHome() }),
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
    writeIntegrationConfig({ config, enabled, id: integrationId });

    if (parsed.apiKey !== undefined) {
        writeIntegrationSecret({
            id: integrationId,
            secret: parsed.apiKey ? { apiKey: parsed.apiKey } : {},
        });
    }

    return getMerchbaseSettings();
}

export async function ensureMerchbaseSkillForEnablement(input: { hermesHome?: string } = {}) {
    await ensureManagedMerchbaseSkill({
        hermesHome: input.hermesHome ?? resolveEffectiveHermesHome(),
        replaceExisting: true,
    });
}

export async function applyMerchbaseAgentCapabilityEnablement(enabled: boolean) {
    const client = createLocalHermesClient();
    try {
        const operations: Promise<unknown>[] = [
            client.updateToolsetEnabled(integrationId, { enabled }),
        ];
        if (await isManagedMerchbaseSkillInstalled()) {
            operations.push(client.updateSkillEnabled(integrationId, { enabled }));
        }
        await Promise.allSettled(operations);
    } finally {
        client.close();
    }
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

function resolveEffectiveHermesHome() {
    return resolveConfiguredPath(
        readConfigValue('TAVERN_HERMES_HOME') ?? readConfigValue('HERMES_HOME') ?? HERMES_HOME
    );
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
    const envApiKey = readConfigValue('TAVERN_MERCHBASE_API_KEY');
    const envEnabled = parseBoolean(readConfigValue('TAVERN_MERCHBASE_ENABLED'));
    return {
        apiKey: envApiKey ?? stored.secret.apiKey ?? null,
        baseUrl: readConfigValue('TAVERN_MERCHBASE_BASE_URL') ?? stored.config.baseUrl,
        defaultAccount:
            readConfigValue('TAVERN_MERCHBASE_DEFAULT_ACCOUNT') ?? stored.config.defaultAccount,
        defaultMarketplace:
            readConfigValue('TAVERN_MERCHBASE_DEFAULT_MARKETPLACE') ??
            stored.config.defaultMarketplace,
        enabled: envEnabled ?? (stored.enabled || Boolean(envApiKey)),
        updatedAt: stored.updatedAt,
    };
}

function resolveStoredMerchbaseSettings() {
    const integration = getIntegration(integrationId);
    return {
        config: readIntegrationConfig(integrationId, storedMerchbaseConfigSchema),
        enabled: integration.enabled,
        secret: readIntegrationSecret(integrationId, storedMerchbaseSecretSchema) ?? {},
        updatedAt: integration.updatedAt,
    };
}

function parseBoolean(value: string | null): boolean | null {
    if (!value) {
        return null;
    }
    if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) {
        return false;
    }
    return null;
}
