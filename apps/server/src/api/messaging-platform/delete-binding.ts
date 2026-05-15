import { z } from 'zod';
import { deleteMessagingBinding } from '../../messaging-platform/service.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteMessagingBindingProcedure = publicProcedure
    .input(
        z.object({
            bindingId: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => {
        return await deleteMessagingBinding(input.bindingId);
    });
