import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

export async function setModelProviderEnabled(input: { enabled: boolean; providerId: string }) {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.setModelProviderEnabled(input.providerId, { enabled: input.enabled });
    } finally {
        client.close();
    }
}
