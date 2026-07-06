import { updateTaskInputSchema } from '../../tasks/contracts.ts';
import { updateTask } from '../../tasks/mutations.ts';
import { publicProcedure } from '../trpc.ts';

export const updateTaskRoute = publicProcedure
    .input(updateTaskInputSchema)
    .mutation(async ({ input }) => {
        return await updateTask(input);
    });
