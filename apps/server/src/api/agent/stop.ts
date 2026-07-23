import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

// The human interrupt at agent scope (I1: Stop lives on agent presence):
// stops the agent's running turn and clears its queued backlog.
export const stopAgentRoute = publicProcedure
    .input(z.object({ agentId: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }
        try {
            return await client.stopAgent(input.agentId);
        } finally {
            client.close();
        }
    });
