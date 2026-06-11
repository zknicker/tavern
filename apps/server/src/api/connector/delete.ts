import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteConnectorProcedure = publicProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.deleteConnector(input.id);
        } finally {
            client.close();
        }
    });
