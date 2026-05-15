import { updateCronJobInputSchema } from '../../cron/contracts.ts';
import { updateCronJob } from '../../cron/update.ts';
import { publicProcedure } from '../trpc.ts';

export const updateCronJobRoute = publicProcedure
    .input(updateCronJobInputSchema)
    .mutation(async ({ input }) => {
        return await updateCronJob({
            jobId: input.jobId,
            patch: input.patch,
        });
    });
