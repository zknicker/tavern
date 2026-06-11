import { agentRuntimeSaveConnectorSchema } from '@tavern/api';
import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const updateConnectorProcedure = publicProcedure
    .input(
        z.object({
            connector: agentRuntimeSaveConnectorSchema,
            id: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.updateConnector(input.id, input.connector);
        } finally {
            client.close();
        }
    });
