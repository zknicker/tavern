import type { AgentRuntimeModels } from '@tavern/api';
import { readConfigValue } from '../config.ts';
import { type ModelCatalogProviderSpec, modelCatalogProviderSpecs } from './provider-registry.ts';
import { providerEntry, sortModels } from './provider-sources/shared.ts';

export async function listAgentModels(): Promise<AgentRuntimeModels> {
    const resolvedProviders = await Promise.all(
        modelCatalogProviderSpecs().map(resolveProviderCatalog)
    );

    return {
        apiKeyOptions: [
            {
                description: 'OpenAI API key used by the local agent.',
                docsUrl: 'https://platform.openai.com/docs',
                envKey: 'OPENAI_API_KEY',
                isSet: Boolean(
                    readConfigValue('OPENAI_API_KEY') ?? readConfigValue('TAVERN_AGENT_API_KEY')
                ),
                label: 'OpenAI',
                providerHint: 'openai',
            },
        ],
        models: sortModels(resolvedProviders.flatMap((provider) => provider.models)),
        providers: resolvedProviders.map((provider) => provider.provider),
        updatedAt: new Date().toISOString(),
    };
}

async function resolveProviderCatalog(spec: ModelCatalogProviderSpec) {
    const result = await spec.resolveCatalog();
    return {
        models: result.models.map((model) => ({
            ...model,
            metadata: {
                ...model.metadata,
                authType: spec.authType,
                keyEnv: spec.keyEnv,
                oauthFlow: spec.oauthFlow,
                providerId: spec.provider.id,
            },
        })),
        provider: providerEntry(spec.provider, {
            authenticated: spec.authenticated(),
            authType: spec.authType,
            keyEnv: spec.keyEnv,
            modelCount: result.models.length,
            oauthFlow: spec.oauthFlow,
            warning: result.warning,
        }),
    };
}
