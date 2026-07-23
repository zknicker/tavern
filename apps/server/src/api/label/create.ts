import { z } from 'zod';
import { createRuntimeLabel } from '../../task-reminders/runtime-api.ts';
import { emitLabelsUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const createLabelRoute = publicProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80) }))
    .mutation(async ({ input }) => {
        const result = await createRuntimeLabel(input.name);
        emitLabelsUpdated();
        return result;
    });
