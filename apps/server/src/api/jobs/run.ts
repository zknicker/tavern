import { runJobInputSchema } from '../../jobs/contracts.ts';
import { runJob } from '../../jobs/service.ts';
import { publicProcedure } from '../trpc.ts';

export const runJobRoute = publicProcedure.input(runJobInputSchema).mutation(async ({ input }) => {
    return runJob(input.slug, input.payload);
});
