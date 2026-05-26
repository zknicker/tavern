import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { emitAgentRuntimeCapabilityUpdated } from '../api/invalidation-events.ts';
import { isOpenClawMemoryConfigReady } from '../openclaw-config/fixups/enforce-memory.ts';
import { saveAgentRuntimeCapabilityStatus } from '../storage/agent-runtime-capability-status.ts';

const memoryCapabilityMethod = 'openclaw.memory.verify';

export async function recordOpenClawMemoryCapability(input: {
    client: TavernAgentRuntimeClient;
    runtimeId: string;
}) {
    let hasRequiredConfig = false;

    try {
        const configSnapshot = await input.client.getOpenClawConfig();
        hasRequiredConfig = isOpenClawMemoryConfigReady(configSnapshot.config);
    } catch (error) {
        await saveAgentRuntimeCapabilityStatus({
            capability: 'memory',
            errorCode: 'openclaw_memory_unverifiable',
            method: memoryCapabilityMethod,
            reason: 'Tavern could not verify OpenClaw memory setup.',
            runtimeId: input.runtimeId,
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        });
        emitAgentRuntimeCapabilityUpdated();
        return;
    }

    if (hasRequiredConfig) {
        await saveAgentRuntimeCapabilityStatus({
            capability: 'memory',
            method: memoryCapabilityMethod,
            runtimeId: input.runtimeId,
            state: 'healthy',
        });
        emitAgentRuntimeCapabilityUpdated();
        return;
    }

    await saveAgentRuntimeCapabilityStatus({
        capability: 'memory',
        errorCode: 'openclaw_memory_config_unavailable',
        method: memoryCapabilityMethod,
        reason: 'OpenClaw memory config does not match Tavern requirements.',
        runtimeId: input.runtimeId,
        state: 'unavailable',
        technicalMessage: JSON.stringify({
            hasRequiredConfig,
        }),
    });
    emitAgentRuntimeCapabilityUpdated();
}
