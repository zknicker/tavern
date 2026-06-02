import { createRouter } from '../trpc.ts';
import { checkAgentRuntimeHealthRoute } from './check-health.ts';
import { connectAgentRuntimeRoute } from './connect.ts';
import { disconnectAgentRuntimeRoute } from './disconnect.ts';
import { getAgentRuntimeRoute } from './get.ts';
import { onAgentRuntimeCapabilityUpdated } from './on-capability-updated.ts';
import { onAgentRuntimeUpdate } from './on-update.ts';
import { refreshAgentRuntimeCapabilityRoute } from './refresh-capability.ts';
import { restartAgentRuntimeUpdateRoute } from './restart-update.ts';
import { startAgentRuntimeUpdateRoute } from './start-update.ts';
import { getAgentRuntimeUpdateStatusRoute } from './update-status.ts';

export const agentRuntimeRouter = createRouter({
    checkHealth: checkAgentRuntimeHealthRoute,
    connect: connectAgentRuntimeRoute,
    disconnect: disconnectAgentRuntimeRoute,
    get: getAgentRuntimeRoute,
    onCapabilityUpdated: onAgentRuntimeCapabilityUpdated,
    onUpdate: onAgentRuntimeUpdate,
    refreshCapability: refreshAgentRuntimeCapabilityRoute,
    restartUpdate: restartAgentRuntimeUpdateRoute,
    startUpdate: startAgentRuntimeUpdateRoute,
    updateStatus: getAgentRuntimeUpdateStatusRoute,
});
