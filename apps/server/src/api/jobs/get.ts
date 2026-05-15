import { getJobInputSchema } from '../../jobs/contracts.ts';
import { getJobDetail } from '../../jobs/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getJobRoute = publicProcedure.input(getJobInputSchema).query(async ({ input }) => {
    return {
        job: await getJobDetail(input.slug),
    };
});
