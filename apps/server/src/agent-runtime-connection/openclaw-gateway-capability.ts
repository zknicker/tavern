import {
    recordCapabilityFailure,
    recordCapabilitySuccess,
} from '../agent-runtime/capability-status.ts';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

type AgentRuntimeClient = ReturnType<typeof createAgentRuntimeClientForConnection>;

export async function recordOpenClawGatewayCapability(input: {
    client: AgentRuntimeClient;
    runtimeId: string;
}) {
    try {
        await input.client.getOpenClawGatewayStatus();
        await recordCapabilitySuccess({
            capability: 'gateway',
            method: 'openclaw-gateway/status',
            runtimeId: input.runtimeId,
        });
    } catch (error) {
        await recordCapabilityFailure({
            capability: 'gateway',
            error,
            method: 'openclaw-gateway/status',
            runtimeId: input.runtimeId,
        });
    }
}

export async function refreshOpenClawGatewayCapability(runtimeId: string) {
    const record = await getAgentRuntimeConnection(runtimeId);

    if (!record) {
        return;
    }

    const client = createAgentRuntimeClientForConnection(record);

    try {
        await recordOpenClawGatewayCapability({ client, runtimeId });
    } finally {
        client.close();
    }
}
