import { z } from 'zod';
import { listRuntimeReminderRuns } from '../../task-reminders/runtime-api.ts';
import { publicProcedure } from '../trpc.ts';

export const listReminderRunsRoute = publicProcedure
    .input(
        z
            .object({
                limit: z.number().int().positive().max(200).optional(),
                reminderId: z.string().trim().min(1).optional(),
            })
            .optional()
    )
    .query(async ({ input }) => await listRuntimeReminderRuns(input ?? {}));
