import { z } from 'zod';
import { deleteRuntimeLabel } from '../../task-reminders/runtime-api.ts';
import { emitLabelsUpdated, emitTasksUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteLabelRoute = publicProcedure
    .input(z.object({ labelId: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
        const result = await deleteRuntimeLabel(input.labelId);
        emitLabelsUpdated();
        emitTasksUpdated();
        return result;
    });
