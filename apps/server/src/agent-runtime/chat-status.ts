import type { AgentRuntimeChatStatusList } from '@tavern/agent-runtime-protocol';
import { AgentRuntimeRequestError, type TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

export async function listAgentRuntimeChatStatuses(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeChatStatusList | null> {
    if (!client) {
        return null;
    }

    try {
        return await client.listChatStatuses();
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    }
}
