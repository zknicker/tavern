import { createCronJobInputSchema } from '../../cron/contracts.ts';
import { createCronJob } from '../../cron/create.ts';
import { publicProcedure } from '../trpc.ts';

export const createCronJobRoute = publicProcedure
    .input(createCronJobInputSchema)
    .mutation(async ({ input }) => {
        return await createCronJob(input);
    });
