import { recordCapabilityStatus } from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { isOpenClawMemoryConfigReady } from '../openclaw-config/fixups/enforce-memory.ts';

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
        await recordCapabilityStatus({
            capability: 'memory',
            errorCode: 'openclaw_memory_unverifiable',
            method: memoryCapabilityMethod,
            reason: 'Tavern could not verify OpenClaw memory setup.',
            runtimeId: input.runtimeId,
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        });
        return;
    }

    if (hasRequiredConfig) {
        await recordCapabilityStatus({
            capability: 'memory',
            method: memoryCapabilityMethod,
            runtimeId: input.runtimeId,
            state: 'healthy',
        });
        return;
    }

    await recordCapabilityStatus({
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
}
