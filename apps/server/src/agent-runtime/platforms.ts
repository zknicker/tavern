import type { AgentRuntimeBinding, AgentRuntimeUpsertBinding } from '@tavern/api';
import type { TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

const agentRuntimeNotConfiguredMessage = 'Grotto Runtime is not configured.';

function requireAgentRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error(agentRuntimeNotConfiguredMessage);
    }

    return client;
}

export async function listAgentRuntimeBindings(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeBinding[]> {
    if (!client) {
        return [];
    }

    return (await client.listBindings()).bindings;
}

export async function saveAgentRuntimeBinding(
    input: AgentRuntimeUpsertBinding,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeBinding> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.upsertBinding(input);
}

export async function deleteAgentRuntimeBinding(
    bindingId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.deleteBinding(bindingId);
}
