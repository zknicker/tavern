import { z } from 'zod';
import { updateHermesAgentAppearance } from '../../hermes-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentAppearanceProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            avatar: z.string().trim().max(8).nullable().optional(),
            emoji: z.string().trim().max(8).nullable().optional(),
        })
    )
    .mutation(async ({ input }) => await updateHermesAgentAppearance(input));
