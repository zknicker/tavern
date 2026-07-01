import type { TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

export async function getAgentRuntimeModels(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient(),
    _runtimeId?: string | null
) {
    if (!client) {
        return null;
    }

    return await client.getModels();
}

export async function getAgentRuntimeModelProviderCatalog(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    return await client.getModelProviderCatalog();
}

export async function getAgentRuntimeEnabledModelProviders(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    return await client.getModelProvidersEnabled();
}
