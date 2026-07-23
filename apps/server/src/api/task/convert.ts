import { z } from 'zod';
import { convertRuntimeTask } from '../../task-reminders/runtime-api.ts';
import { emitChatLogUpdated, emitTasksUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const convertTaskRoute = publicProcedure
    .input(
        z.object({
            assigneeId: z.string().trim().min(1).optional(),
            messageId: z.string().trim().min(1),
            origin: z.enum(['composed', 'converted']).optional(),
        })
    )
    .mutation(async ({ input }) => {
        const result = await convertRuntimeTask(input);
        emitTasksUpdated();
        emitChatLogUpdated();
        return result;
    });
