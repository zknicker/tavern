import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

export async function listAgentRuntimeTools(
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
                  method: 'tools.status',
                  runtimeId: capabilityRuntimeId,
              },
              async () => await client.listTools()
          )
        : await client.listTools();
    return response.tools;
}

export async function setAgentRuntimeToolEnabled(
    toolId: string,
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
                  method: 'tools.update',
                  runtimeId: capabilityRuntimeId,
              },
              async () => await client.updateToolEnabled(toolId, input)
          )
        : await client.updateToolEnabled(toolId, input);
}
