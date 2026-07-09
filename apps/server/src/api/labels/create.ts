import { createTaskLabel } from '../../agent-runtime/labels.ts';
import { emitLabelsUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';
import { createLabelInputSchema, labelSchema } from './contracts.ts';

export const createLabelRoute = publicProcedure
    .input(createLabelInputSchema)
    .mutation(async ({ input }) => {
        const label = await createTaskLabel(input);
        emitLabelsUpdated();
        return labelSchema.parse(label);
    });
