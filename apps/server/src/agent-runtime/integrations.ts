import type { TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

export async function listAgentRuntimeIntegrations(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    const response = await client.listIntegrations();
    return response.integrations;
}
