import { z } from 'zod';
import { publicProcedure } from '../trpc.ts';

export const deleteMessagingBindingProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            bindingId: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => {
        throw new Error(
            `Agent Discord binding edits are not available in Tavern yet: ${input.bindingId}.`
        );
    });
