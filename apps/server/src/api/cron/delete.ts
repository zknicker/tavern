import { deleteCronJobInputSchema } from '../../cron/contracts.ts';
import { deleteCronJob } from '../../cron/delete.ts';
import { publicProcedure } from '../trpc.ts';

export const deleteCronJobRoute = publicProcedure
    .input(deleteCronJobInputSchema)
    .mutation(async ({ input }) => {
        return await deleteCronJob(input.jobId);
    });
