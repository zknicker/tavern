import { createRouter } from '../trpc.ts';
import { checkAgentRuntimeHealthRoute } from './check-health.ts';
import { connectAgentRuntimeRoute } from './connect.ts';
import { getAgentRuntimeRoute } from './get.ts';
import { onAgentRuntimeCapabilityUpdated } from './on-capability-updated.ts';
import { onAgentRuntimeUpdate } from './on-update.ts';
import { refreshAgentRuntimeCapabilityRoute } from './refresh-capability.ts';

export const agentRuntimeRouter = createRouter({
    checkHealth: checkAgentRuntimeHealthRoute,
    connect: connectAgentRuntimeRoute,
    get: getAgentRuntimeRoute,
    onCapabilityUpdated: onAgentRuntimeCapabilityUpdated,
    onUpdate: onAgentRuntimeUpdate,
    refreshCapability: refreshAgentRuntimeCapabilityRoute,
});
