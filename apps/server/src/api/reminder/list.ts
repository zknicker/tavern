import { z } from 'zod';
import { listRuntimeReminders } from '../../task-reminders/runtime-api.ts';
import { publicProcedure } from '../trpc.ts';

export const listRemindersRoute = publicProcedure
    .input(
        z
            .object({
                statuses: z.array(z.enum(['scheduled', 'fired', 'canceled'])).optional(),
            })
            .optional()
    )
    .query(async ({ input }) => await listRuntimeReminders(input?.statuses));
