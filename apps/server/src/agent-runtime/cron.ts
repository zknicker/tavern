import {
    type AgentRuntimeCreateCron,
    type AgentRuntimeCron,
    type AgentRuntimeCronRun,
    type AgentRuntimeRunCron,
    type AgentRuntimeUpdateCron,
    agentRuntimeCreateCronSchema,
    agentRuntimeUpdateCronSchema,
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

export async function listCronJobs(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    const response = await client.listCronJobs();
    return response.jobs;
}

export async function listCronRuns(
    jobId?: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    const response = await client.listCronRuns(jobId);
    return response.runs;
}

export async function getCronJob(
    jobId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    if (!client) {
        return null;
    }

    try {
        return await client.getCronJob(jobId);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    }
}

export async function createCronJob(
    input: AgentRuntimeCreateCron,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeCron> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.createCronJob(agentRuntimeCreateCronSchema.parse(input));
}

export async function updateCronJob(
    jobId: string,
    input: AgentRuntimeUpdateCron,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeCron> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.updateCronJob(jobId, agentRuntimeUpdateCronSchema.parse(input));
}

export async function deleteCronJob(
    jobId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeClient = requireAgentRuntimeClient(client);

    try {
        await agentRuntimeClient.deleteCronJob(jobId);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return {
                deleted: false,
            } as const;
        }

        throw error;
    }

    return {
        deleted: true,
    } as const;
}

export async function runCronJob(
    jobId: string,
    input: AgentRuntimeRunCron = { mode: 'force' },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeCronRun> {
    const agentRuntimeClient = requireAgentRuntimeClient(client);
    return await agentRuntimeClient.runCronJob(jobId, input);
}
