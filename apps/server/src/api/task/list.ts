import { z } from 'zod';
import { listRuntimeTasks } from '../../task-reminders/runtime-api.ts';
import { publicProcedure } from '../trpc.ts';

export const listTasksRoute = publicProcedure
    .input(
        z
            .object({
                chatId: z.string().trim().min(1).optional(),
                status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'closed']).optional(),
            })
            .optional()
    )
    .query(async ({ input }) => await listRuntimeTasks(input ?? {}));
