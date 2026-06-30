import { z } from 'zod';
import { updateAgentName } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentNameProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            name: z.string().trim().min(1).max(80),
        })
    )
    .mutation(async ({ input }) => await updateAgentName(input));
