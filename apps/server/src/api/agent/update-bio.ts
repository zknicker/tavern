import { z } from 'zod';
import { updateAgentBio } from '../../agent-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const updateAgentBioProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            bio: z
                .string()
                .trim()
                .max(280)
                .nullable()
                .transform((value) => (value && value.length > 0 ? value : null)),
        })
    )
    .mutation(async ({ input }) => await updateAgentBio(input));
