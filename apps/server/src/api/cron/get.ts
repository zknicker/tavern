import { cronGetSchema, getCronJobInputSchema } from '../../cron/contracts.ts';
import { getCronJob } from '../../cron/list.ts';
import { publicProcedure } from '../trpc.ts';

export const getCronJobRoute = publicProcedure
    .input(getCronJobInputSchema)
    .output(cronGetSchema)
    .query(({ input }) => getCronJob(input));
