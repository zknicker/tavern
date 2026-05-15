import { toggleCronJobInputSchema } from '../../cron/contracts.ts';
import { updateCronJob } from '../../cron/update.ts';
import { publicProcedure } from '../trpc.ts';

export const toggleCronJobRoute = publicProcedure
    .input(toggleCronJobInputSchema)
    .mutation(async ({ input }) => {
        return await updateCronJob({
            jobId: input.jobId,
            patch: {
                enabled: input.enabled,
            },
        });
    });
