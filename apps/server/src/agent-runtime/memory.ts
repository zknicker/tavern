import type {
    AgentRuntimeMemorySettings,
    AgentRuntimeMemoryStatus,
} from '@tavern/agent-runtime-protocol';
import type { TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

const agentRuntimeNotConfiguredMessage = 'Tavern Runtime is not configured.';

function requireAgentRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error(agentRuntimeNotConfiguredMessage);
    }

    return client;
}

export async function getAgentRuntimeMemorySettings(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    return await client.getMemorySettings();
}

export async function saveAgentRuntimeMemorySettings(
    input: Omit<AgentRuntimeMemorySettings, 'updatedAt'>,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeMemorySettings> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.saveMemorySettings(input);
}

export async function getAgentRuntimeMemoryStatus(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<null | AgentRuntimeMemoryStatus> {
    if (!client) {
        return null;
    }

    return await client.getMemoryStatus();
}
