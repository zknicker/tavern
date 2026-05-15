import type { AgentRuntimeModels, AgentRuntimeSaveModels } from '@tavern/agent-runtime-protocol';
import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

const agentRuntimeNotConfiguredMessage = 'Tavern Runtime is not configured.';

function requireAgentRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error(agentRuntimeNotConfiguredMessage);
    }

    return client;
}

export async function getAgentRuntimeModels(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient(),
    runtimeId?: string | null
) {
    if (!client) {
        return null;
    }

    const capabilityRuntimeId = runtimeId ?? getCurrentConfiguredAgentRuntimeConnection()?.id;

    if (!capabilityRuntimeId) {
        return await client.getModels();
    }

    return await withCapabilityStatus(
        {
            capability: 'models',
            method: 'models.list',
            runtimeId: capabilityRuntimeId,
        },
        async () => await client.getModels()
    );
}

export async function saveAgentRuntimeModels(
    input: AgentRuntimeSaveModels,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeModels> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.saveModels(input);
}
