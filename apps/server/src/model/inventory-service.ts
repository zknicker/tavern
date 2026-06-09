import { getAgentRuntimeModels } from '../agent-runtime/models.ts';
import type { ModelInventory, ModelInventoryProvider } from './inventory-contracts.ts';
import { modelInventorySchema } from './inventory-contracts.ts';

export async function listModelInventory(): Promise<ModelInventory> {
    const response = await getAgentRuntimeModels();
    const models = response?.models ?? [];
    const runtimeProviders = response?.providers ?? [];
    const providersById = new Map<string, ModelInventoryProvider>();

    for (const provider of runtimeProviders) {
        providersById.set(
            provider.id,
            createInventoryProvider({
                authType: provider.authType,
                isConnected: provider.authenticated,
                keyEnv: provider.keyEnv,
                label: provider.label,
                oauthFlow: provider.oauthFlow,
                provider: provider.id,
                warning: provider.warning,
            })
        );
    }

    for (const model of models) {
        const parsed = parseRuntimeModel(model);
        if (!parsed) {
            continue;
        }
        const provider =
            providersById.get(parsed.provider) ??
            createInventoryProvider({
                authType: null,
                isConnected: true,
                keyEnv: null,
                label: null,
                oauthFlow: null,
                provider: parsed.provider,
                warning: null,
            });

        if (!provider.isConnected) {
            providersById.set(parsed.provider, provider);
            continue;
        }

        provider.models.push({
            canDelete: false,
            capabilities: ['general'],
            contextWindow: null,
            description: null,
            displayName: model.label?.trim() || parsed.modelId,
            inUse: false,
            modelId: parsed.modelId,
            provider: parsed.provider,
            ref: parsed.ref,
            usageLabels: [],
        });
        providersById.set(parsed.provider, provider);
    }

    return modelInventorySchema.parse({
        apiKeyOptions: response?.apiKeyOptions ?? [],
        providers: [...providersById.values()]
            .map((provider) => ({
                ...provider,
                models: provider.models.sort(
                    (left, right) =>
                        left.displayName.localeCompare(right.displayName) ||
                        left.ref.localeCompare(right.ref)
                ),
            }))
            .sort(
                (left, right) =>
                    left.displayName.localeCompare(right.displayName) ||
                    left.provider.localeCompare(right.provider)
            ),
    });
}

function parseRuntimeModel(input: { id: string; provider: string | null }) {
    const separatorIndex = input.id.indexOf('/');
    const provider =
        input.provider ?? (separatorIndex > 0 ? input.id.slice(0, separatorIndex) : null);
    if (!provider) {
        return null;
    }
    const modelId = separatorIndex > 0 ? input.id.slice(separatorIndex + 1) : input.id;
    return {
        modelId,
        provider,
        ref: `${provider}/${modelId}`,
    };
}

function createInventoryProvider(input: {
    authType: string | null;
    isConnected: boolean;
    keyEnv: string | null;
    label: string | null;
    oauthFlow: string | null;
    provider: string;
    warning: string | null;
}): ModelInventoryProvider {
    const keyEnv = input.keyEnv ?? extractProviderKeyEnv(input.warning);
    const authAction = getAuthAction(input.authType, input.oauthFlow, keyEnv);
    return {
        authAction,
        authType: input.authType,
        connectionDetail: input.isConnected ? null : input.warning,
        displayName: input.label?.trim() || formatProviderName(input.provider),
        isConnected: input.isConnected,
        keyEnv,
        models: [],
        provider: input.provider,
        state: input.isConnected ? 'connected' : 'not-configured',
        stateMessage: input.isConnected ? 'Connected' : getDisconnectedMessage(authAction),
    };
}

function getAuthAction(authType: string | null, oauthFlow: string | null, keyEnv: string | null) {
    if (oauthFlow === 'external' || (authType === 'oauth_external' && !oauthFlow)) {
        return 'external' as const;
    }
    if (authType?.startsWith('oauth') || oauthFlow) {
        return 'oauth' as const;
    }
    if (authType === 'api_key' && keyEnv) {
        return 'api-key' as const;
    }
    if (authType === 'external_process') {
        return 'external' as const;
    }
    if (authType === 'aws_sdk') {
        return 'system' as const;
    }
    return null;
}

function getDisconnectedMessage(authAction: ReturnType<typeof getAuthAction>) {
    switch (authAction) {
        case 'api-key':
            return 'Add API key';
        case 'oauth':
            return 'Sign in';
        case 'external':
            return 'External setup required';
        case 'system':
            return 'System credentials required';
        default:
            return 'Not configured';
    }
}

function extractProviderKeyEnv(warning: string | null) {
    return warning?.match(/\b[A-Z][A-Z0-9_]*_API_KEY\b/u)?.[0] ?? null;
}

function formatProviderName(provider: string) {
    return provider
        .trim()
        .split(/[-_/]+/gu)
        .filter(Boolean)
        .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
        .join(' ');
}
