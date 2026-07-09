import {
    type AgentRuntimeCreateTaskLabel,
    type AgentRuntimeTaskLabel,
    type AgentRuntimeTaskLabelList,
    type AgentRuntimeUpdateTaskLabel,
    agentRuntimeCreateTaskLabelSchema,
    agentRuntimeUpdateTaskLabelSchema,
} from '@tavern/api';
import type { TavernAgentRuntimeClient } from './client.ts';
import { AgentRuntimeRequestError } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

const agentRuntimeNotConfiguredMessage = 'Tavern Runtime is not configured.';

function requireAgentRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error(agentRuntimeNotConfiguredMessage);
    }

    return client;
}

export async function listTaskLabels(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeTaskLabelList> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.listTaskLabels();
}

export async function createTaskLabel(
    input: AgentRuntimeCreateTaskLabel,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeTaskLabel> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.createTaskLabel(agentRuntimeCreateTaskLabelSchema.parse(input));
}

export async function updateTaskLabel(
    labelId: string,
    input: AgentRuntimeUpdateTaskLabel,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeTaskLabel | null> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);

    try {
        return await agentRuntimeClient.updateTaskLabel(
            labelId,
            agentRuntimeUpdateTaskLabelSchema.parse(input)
        );
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    }
}

export async function deleteTaskLabel(
    labelId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeClient = requireAgentRuntimeClient(client);

    try {
        await agentRuntimeClient.deleteTaskLabel(labelId);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return { deleted: false as const, labelId };
        }

        throw error;
    }

    return { deleted: true as const, labelId };
}
