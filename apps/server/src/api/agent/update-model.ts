import { z } from 'zod';
import { updateAgentModel } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentModelProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            modelRef: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => await updateAgentModel(input));
