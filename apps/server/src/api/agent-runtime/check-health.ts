import { refreshAgentRuntimeEventSync } from '../../agent-runtime/event-sync.ts';
import { agentRuntimeConnectionStatusSchema } from '../../agent-runtime-connection/contracts.ts';
import {
    confirmAgentRuntimeConnection,
    getAgentRuntimeConnection,
} from '../../agent-runtime-connection/service.ts';
import { refreshOpenClawSyncJobSchedules } from '../../jobs/manager.ts';
import { listAgentRuntimeCapabilityStatuses } from '../../storage/agent-runtime-capability-status.ts';
import { emitAgentRuntimeUpdated, emitSyncDataUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const checkAgentRuntimeHealthRoute = publicProcedure.mutation(async () => {
    const connection = await getAgentRuntimeConnection();

    if (!connection) {
        return agentRuntimeConnectionStatusSchema.parse({
            capabilities: [],
            lastCheckedAt: null,
            lastError: null,
            state: 'unconfigured',
            url: null,
        });
    }

    if (await confirmAgentRuntimeConnection()) {
        const refreshedConnection = await getAgentRuntimeConnection();
        const runtimeId = refreshedConnection?.id ?? connection.id;
        const capabilities = await listAgentRuntimeCapabilityStatuses(runtimeId);

        refreshAgentRuntimeEventSync();
        await refreshOpenClawSyncJobSchedules({ runImmediately: true });
        emitAgentRuntimeUpdated();
        emitSyncDataUpdated();

        return agentRuntimeConnectionStatusSchema.parse({
            capabilities,
            lastCheckedAt: new Date().toISOString(),
            lastError: null,
            state: 'reachable',
            url: refreshedConnection?.baseUrl ?? connection.baseUrl,
        });
    }

    const refreshedConnection = await getAgentRuntimeConnection();
    const capabilities = await listAgentRuntimeCapabilityStatuses(connection.id);

    refreshAgentRuntimeEventSync();
    await refreshOpenClawSyncJobSchedules();
    emitAgentRuntimeUpdated();
    emitSyncDataUpdated();

    return agentRuntimeConnectionStatusSchema.parse({
        capabilities,
        lastCheckedAt: refreshedConnection?.lastCheckedAt ?? new Date().toISOString(),
        lastError: refreshedConnection?.lastError ?? 'Failed to reach Tavern Runtime.',
        state: 'unreachable',
        url: connection.baseUrl,
    });
});
