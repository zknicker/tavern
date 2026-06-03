import { z } from 'zod';
import { updateOpenClawAgentModel } from '../../openclaw-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentModelProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            openClawModelNameId: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => await updateOpenClawAgentModel(input));
