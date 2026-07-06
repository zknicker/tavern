import { z } from 'zod';
import { createAgent } from '../../agent-settings/service.ts';
import { agentPrimaryColorSchema } from '../../agents/catalog.ts';
import {
    emitAgentInvalidationCascade,
    emitChatUpdated,
    emitModelUpdated,
} from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const createAgentInputSchema = z.object({
    name: z.string().trim().min(1).max(80),
    primaryColor: agentPrimaryColorSchema.optional(),
});

export const createAgentProcedure = publicProcedure
    .input(createAgentInputSchema)
    .mutation(async ({ input }) => {
        const agent = await createAgent(input);
        emitAgentInvalidationCascade();
        emitChatUpdated();
        emitModelUpdated();
        return { agent };
    });
