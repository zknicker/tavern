import { agentRuntimeMerchbaseSalesSeriesInputSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const merchbaseSalesSeriesProcedure = publicProcedure
    .input(agentRuntimeMerchbaseSalesSeriesInputSchema)
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }

        try {
            return await client.queryMerchbaseSalesSeries(input);
        } finally {
            client.close();
        }
    });
