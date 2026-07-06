import { z } from 'zod';
import { deleteCatalogAgent } from '../../agents/catalog.ts';
import { emitAgentInvalidationCascade, emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const deleteAgentInputSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const deleteAgent = publicProcedure
    .input(deleteAgentInputSchema)
    .mutation(async ({ input }) => {
        await deleteCatalogAgent(input.agentId);
        emitAgentInvalidationCascade();
        emitChatUpdated();
        return {
            agentId: input.agentId,
        };
    });
