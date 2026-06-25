import { agentRuntimeMerchbaseActionInputSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const merchbaseActionProcedure = publicProcedure
    .input(agentRuntimeMerchbaseActionInputSchema)
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.queryMerchbaseAction(input);
        } finally {
            client.close();
        }
    });
