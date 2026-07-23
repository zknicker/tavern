import { z } from 'zod';
import { cancelRuntimeReminder } from '../../task-reminders/runtime-api.ts';
import { emitRemindersUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const cancelReminderRoute = publicProcedure
    .input(z.object({ reminderId: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
        const result = await cancelRuntimeReminder(input.reminderId);
        emitRemindersUpdated();
        return result;
    });
