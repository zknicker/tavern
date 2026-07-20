import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getMemoryActivityProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Grotto Runtime is not connected.');
    }

    try {
        return await client.getMemoryActivity();
    } finally {
        client.close();
    }
});
