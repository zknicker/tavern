import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

export async function listAgentRuntimeToolsets(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient(),
    runtimeId?: string | null
) {
    if (!client) {
        return null;
    }

    const capabilityRuntimeId = runtimeId ?? getCurrentConfiguredAgentRuntimeConnection()?.id;
    const response = capabilityRuntimeId
        ? await withCapabilityStatus(
              {
                  capability: 'skills',
                  method: 'toolsets.status',
                  runtimeId: capabilityRuntimeId,
              },
              async () => await client.listToolsets()
          )
        : await client.listToolsets();
    return response.toolsets;
}

export async function setAgentRuntimeToolsetEnabled(
    toolsetId: string,
    input: { enabled: boolean },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient(),
    runtimeId?: string | null
) {
    if (!client) {
        return null;
    }

    const capabilityRuntimeId = runtimeId ?? getCurrentConfiguredAgentRuntimeConnection()?.id;
    return capabilityRuntimeId
        ? await withCapabilityStatus(
              {
                  capability: 'skills',
                  method: 'toolsets.update',
                  runtimeId: capabilityRuntimeId,
              },
              async () => await client.updateToolsetEnabled(toolsetId, input)
          )
        : await client.updateToolsetEnabled(toolsetId, input);
}
