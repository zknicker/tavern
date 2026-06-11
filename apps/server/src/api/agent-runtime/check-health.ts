import { refreshAgentRuntimeEventSync } from '../../agent-runtime/event-sync.ts';
import { agentRuntimeConnectionStatusSchema } from '../../agent-runtime-connection/contracts.ts';
import {
    confirmAgentRuntimeConnection,
    getAgentRuntimeConnection,
} from '../../agent-runtime-connection/service.ts';
import { emitAgentRuntimeUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const checkAgentRuntimeHealthRoute = publicProcedure.mutation(async () => {
    const connection = await getAgentRuntimeConnection({ refreshStatus: false });

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
        const refreshedConnection = await getAgentRuntimeConnection({ refreshStatus: false });
        const capabilities = refreshedConnection?.capabilities ?? connection.capabilities;

        refreshAgentRuntimeEventSync();
        emitAgentRuntimeUpdated();

        return agentRuntimeConnectionStatusSchema.parse({
            capabilities,
            lastCheckedAt: new Date().toISOString(),
            lastError: null,
            state: 'reachable',
            url: refreshedConnection?.baseUrl ?? connection.baseUrl,
        });
    }

    const refreshedConnection = await getAgentRuntimeConnection({ refreshStatus: false });
    const capabilities = refreshedConnection?.capabilities ?? connection.capabilities;

    refreshAgentRuntimeEventSync();
    emitAgentRuntimeUpdated();

    return agentRuntimeConnectionStatusSchema.parse({
        capabilities,
        lastCheckedAt: refreshedConnection?.lastCheckedAt ?? new Date().toISOString(),
        lastError: refreshedConnection?.lastError ?? 'Failed to reach Tavern Runtime.',
        state: 'unreachable',
        url: connection.baseUrl,
    });
});
