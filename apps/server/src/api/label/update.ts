import { z } from 'zod';
import { updateRuntimeLabel } from '../../task-reminders/runtime-api.ts';
import { emitLabelsUpdated, emitTasksUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const labelColorSchema = z.enum([
    'red',
    'orange',
    'amber',
    'green',
    'teal',
    'blue',
    'purple',
    'pink',
    'gray',
]);

export const updateLabelRoute = publicProcedure
    .input(
        z.object({
            labelId: z.string().trim().min(1),
            patch: z.object({
                color: labelColorSchema.optional(),
                name: z.string().trim().min(1).max(80).optional(),
            }),
        })
    )
    .mutation(async ({ input }) => {
        const result = await updateRuntimeLabel(input);
        emitLabelsUpdated();
        emitTasksUpdated();
        return result;
    });
