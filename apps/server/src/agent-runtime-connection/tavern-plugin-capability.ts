import type { AgentRuntimeStatus } from '@tavern/api';
import { saveAgentRuntimeCapabilityStatus } from '../storage/agent-runtime-capability-status.ts';

export async function recordTavernPluginCapability(input: {
    runtimeId: string;
    status: AgentRuntimeStatus;
}) {
    if (input.status.identity.capabilities.includes('tavernPlugin')) {
        await saveAgentRuntimeCapabilityStatus({
            capability: 'tavernPlugin',
            method: 'runtime/status',
            runtimeId: input.runtimeId,
            state: 'healthy',
        });
        return;
    }

    await saveAgentRuntimeCapabilityStatus({
        capability: 'tavernPlugin',
        errorCode: 'tavern_plugin_not_installed',
        method: 'runtime/status',
        reason: 'Tavern Runtime has not installed the managed Tavern Messenger plugin.',
        runtimeId: input.runtimeId,
        state: 'unavailable',
        technicalMessage: 'Runtime status did not advertise tavernPlugin.',
    });
}
