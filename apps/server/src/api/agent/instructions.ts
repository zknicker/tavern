import { z } from 'zod';
import { getCatalogAgentInstructions } from '../../agents/catalog.ts';
import { publicProcedure } from '../trpc.ts';

const getAgentInstructionsInputSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const getAgentInstructions = publicProcedure
    .input(getAgentInstructionsInputSchema)
    .query(async ({ input }) => {
        return getCatalogAgentInstructions(input.agentId);
    });
