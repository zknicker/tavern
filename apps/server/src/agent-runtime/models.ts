import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

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
