import { deleteTaskInputSchema } from '../../tasks/contracts.ts';
import { deleteTask } from '../../tasks/mutations.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteTaskRoute = publicProcedure
    .input(deleteTaskInputSchema)
    .mutation(async ({ input }) => {
        return await deleteTask(input);
    });
