import type {
    AgentRuntimeToolsetEnvUpdate,
    AgentRuntimeToolsetPostSetup,
    AgentRuntimeToolsetProviderSelect,
} from '@tavern/api';
import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

export async function getAgentRuntimeToolsetConfig(toolsetId: string) {
    return await callToolsetSetup(
        'toolsets.config',
        async (client) => await client.getToolsetConfig(toolsetId)
    );
}

export async function selectAgentRuntimeToolsetProvider(
    toolsetId: string,
    input: AgentRuntimeToolsetProviderSelect
) {
    return await callToolsetSetup(
        'toolsets.setup',
        async (client) => await client.selectToolsetProvider(toolsetId, input)
    );
}

export async function saveAgentRuntimeToolsetEnv(
    toolsetId: string,
    input: AgentRuntimeToolsetEnvUpdate
) {
    return await callToolsetSetup(
        'toolsets.setup',
        async (client) => await client.saveToolsetEnv(toolsetId, input)
    );
}

export async function runAgentRuntimeToolsetPostSetup(
    toolsetId: string,
    input: AgentRuntimeToolsetPostSetup
) {
    return await callToolsetSetup(
        'toolsets.setup',
        async (client) => await client.runToolsetPostSetup(toolsetId, input)
    );
}

async function callToolsetSetup<Result>(
    method: 'toolsets.config' | 'toolsets.setup',
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
