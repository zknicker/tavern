import { runCronJobInputSchema } from '../../cron/contracts.ts';
import { runCronJob } from '../../cron/run.ts';
import { publicProcedure } from '../trpc.ts';

export const runCronJobRoute = publicProcedure
    .input(runCronJobInputSchema)
    .mutation(async ({ input }) => {
        return await runCronJob({
            jobId: input.jobId,
            mode: input.mode,
        });
    });
