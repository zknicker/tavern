import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { emitAgentRuntimeCapabilityUpdated } from '../api/invalidation-events.ts';
import { isOpenClawMemoryConfigReady } from '../openclaw-config/fixups/enforce-memory.ts';
import { saveAgentRuntimeCapabilityStatus } from '../storage/agent-runtime-capability-status.ts';

const memoryCapabilityMethod = 'openclaw.memory.verify';
const losslessInstallHint = 'Install @martian-engineering/lossless-claw for managed OpenClaw.';

export async function recordOpenClawMemoryCapability(input: {
    client: TavernAgentRuntimeClient;
    runtimeId: string;
}) {
    let hasLosslessClaw = false;
    let hasRequiredConfig = false;

    try {
        const configSnapshot = await input.client.getOpenClawConfig();
        hasLosslessClaw = isLosslessClawConfigured(configSnapshot.config);
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

    if (hasLosslessClaw && hasRequiredConfig) {
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
        errorCode: hasLosslessClaw ? 'openclaw_memory_config_unavailable' : 'lossless_claw_missing',
        method: memoryCapabilityMethod,
        reason: hasLosslessClaw
            ? 'OpenClaw memory config does not match Tavern requirements.'
            : `Lossless Claw is not installed or not loaded. ${losslessInstallHint}`,
        runtimeId: input.runtimeId,
        state: 'unavailable',
        technicalMessage: JSON.stringify({
            hasLosslessClaw,
            hasRequiredConfig,
        }),
    });
    emitAgentRuntimeCapabilityUpdated();
}

function isLosslessClawConfigured(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    const entries = readRecord(plugins.entries);
    const losslessClaw = readRecord(entries['lossless-claw']);

    return losslessClaw.enabled === true;
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}
