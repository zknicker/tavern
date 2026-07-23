import { z } from 'zod';
import { reactToRuntimeMessage } from '../../task-reminders/runtime-api.ts';
import { emitChatLogUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const reactToChatMessageRoute = publicProcedure
    .input(
        z.object({
            emoji: z.string().trim().min(1),
            messageId: z.string().trim().min(1),
            remove: z.boolean().optional(),
        })
    )
    .mutation(async ({ input }) => {
        const result = await reactToRuntimeMessage(input);
        emitChatLogUpdated();
        return result;
    });
