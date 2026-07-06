import { createTaskInputSchema } from '../../tasks/contracts.ts';
import { createTask } from '../../tasks/mutations.ts';
import { publicProcedure } from '../trpc.ts';

export const createTaskRoute = publicProcedure
    .input(createTaskInputSchema)
    .mutation(async ({ input }) => {
        return await createTask(input);
    });
