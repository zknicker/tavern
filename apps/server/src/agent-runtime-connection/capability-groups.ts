import type { AgentRuntimeCapabilityStatus } from './contracts.ts';

const runtimeCapabilityNames = new Set<AgentRuntimeCapabilityStatus['capability']>([
    'tavernPlugin',
    'events',
    'status',
]);

export function splitAgentRuntimeCapabilities(capabilities: AgentRuntimeCapabilityStatus[]) {
    return {
        openClawCapabilities: capabilities.filter(
            (capability) => !runtimeCapabilityNames.has(capability.capability)
        ),
        runtimeCapabilities: capabilities.filter((capability) =>
            runtimeCapabilityNames.has(capability.capability)
        ),
    };
}
