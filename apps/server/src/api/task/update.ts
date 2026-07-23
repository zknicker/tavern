import { z } from 'zod';
import { updateRuntimeTask } from '../../task-reminders/runtime-api.ts';
import { emitChatLogUpdated, emitTasksUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const updateTaskRoute = publicProcedure
    .input(
        z.object({
            messageId: z.string().trim().min(1),
            patch: z.object({
                assigneeId: z.string().trim().min(1).nullable().optional(),
                labelIds: z.array(z.string().trim().min(1)).optional(),
                priority: z.enum(['none', 'urgent', 'high', 'medium', 'low']).optional(),
                status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'closed']).optional(),
            }),
        })
    )
    .mutation(async ({ input }) => {
        const result = await updateRuntimeTask(input);
        emitTasksUpdated();
        emitChatLogUpdated();
        return result;
    });
