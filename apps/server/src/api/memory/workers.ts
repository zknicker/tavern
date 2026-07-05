import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const listMemoryWorkersProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.listMemoryWorkers();
    } finally {
        client.close();
    }
});
