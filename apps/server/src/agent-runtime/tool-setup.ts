import type {
    AgentRuntimeToolEnvUpdate,
    AgentRuntimeToolPostSetup,
    AgentRuntimeToolProviderSelect,
} from '@tavern/api';
import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

export async function getAgentRuntimeToolConfig(toolId: string) {
    return await callToolSetup(
        'tools.config',
        async (client) => await client.getToolConfig(toolId)
    );
}

export async function selectAgentRuntimeToolProvider(
    toolId: string,
    input: AgentRuntimeToolProviderSelect
) {
    return await callToolSetup(
        'tools.setup',
        async (client) => await client.selectToolProvider(toolId, input)
    );
}

export async function saveAgentRuntimeToolEnv(toolId: string, input: AgentRuntimeToolEnvUpdate) {
    return await callToolSetup(
        'tools.setup',
        async (client) => await client.saveToolEnv(toolId, input)
    );
}

export async function runAgentRuntimeToolPostSetup(
    toolId: string,
    input: AgentRuntimeToolPostSetup
) {
    return await callToolSetup(
        'tools.setup',
        async (client) => await client.runToolPostSetup(toolId, input)
    );
}

async function callToolSetup<Result>(
    method: 'tools.config' | 'tools.setup',
    run: (client: TavernAgentRuntimeClient) => Promise<Result>
): Promise<Result | null> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        return null;
    }

    const runtimeId = getCurrentConfiguredAgentRuntimeConnection()?.id;
    return runtimeId
        ? await withCapabilityStatus(
              { capability: 'skills', method, runtimeId },
              async () => await run(client)
          )
        : await run(client);
}
