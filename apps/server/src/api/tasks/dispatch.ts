import { dispatchTaskInputSchema } from '../../tasks/contracts.ts';
import { dispatchTask } from '../../tasks/dispatch.ts';
import { publicProcedure } from '../trpc.ts';

export const dispatchTaskRoute = publicProcedure
    .input(dispatchTaskInputSchema)
    .mutation(async ({ input }) => {
        return await dispatchTask(input);
    });
