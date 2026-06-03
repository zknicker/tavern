import { z } from 'zod';
import { deleteOpenClawDiscordBinding } from '../../openclaw-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteMessagingBindingProcedure = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            bindingId: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => {
        return await deleteOpenClawDiscordBinding(input);
    });
