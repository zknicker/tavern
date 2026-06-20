import type { AgentRuntimeAgent, AgentRuntimeCreateAgent } from '@tavern/api';
import { emitAgentUpdated } from '../api/invalidation-events.ts';
import { AgentRuntimeRequestError, type TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

const agentRuntimeNotConfiguredMessage = 'Tavern Runtime is not configured.';

function requireAgentRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error(agentRuntimeNotConfiguredMessage);
    }

    return client;
}

export function toAgentRuntimeCreateAgentConfig(agent: AgentRuntimeAgent): AgentRuntimeCreateAgent {
    return {
        enabledSkillIds: agent.enabledSkillIds,
        id: agent.id,
        isAdmin: agent.isAdmin,
        name: agent.name,
        primaryColor: agent.primaryColor,
        workspaceFolder: agent.workspaceFolder,
    };
}

export async function deleteAgentRuntimeAgent(
    agentId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.deleteAgent(agentId);
}

export async function listAgentRuntimeAgents(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    return (await client.listAgents()).agents;
}

export async function getAgentRuntimeAgentConfig(
    agentId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    try {
        return await client.getAgentConfig(agentId);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    }
}

export async function saveAgentRuntimeAgentConfig(
    input: AgentRuntimeCreateAgent,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.upsertAgent(input);
}

export async function syncAgents(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeAgents = await listAgentRuntimeAgents(client);

    if (!agentRuntimeAgents) {
        return [];
    }

    emitAgentUpdated();
    return agentRuntimeAgents;
}

export async function syncAgent(
    agentId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeAgent = await getAgentRuntimeAgentConfig(agentId, client);

    if (!agentRuntimeAgent) {
        return null;
    }

    emitAgentUpdated();
    return agentRuntimeAgent;
}
