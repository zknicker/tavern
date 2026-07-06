import { getTaskInputSchema } from '../../tasks/contracts.ts';
import { getTask } from '../../tasks/list.ts';
import { publicProcedure } from '../trpc.ts';

export const getTaskRoute = publicProcedure.input(getTaskInputSchema).query(async ({ input }) => {
    return await getTask(input);
});
