import type { AgentRuntimeCapabilityHealthId } from '@tavern/api';
import { publishRuntimeEvent } from '../tavern/runtime-events';

export function publishCapabilityUpdated(capability: AgentRuntimeCapabilityHealthId) {
    publishRuntimeEvent({
        capability,
        timestamp: new Date().toISOString(),
        type: 'capability.updated',
    });
}
