import { cronJobRunListSchema, listCronRunsInputSchema } from '../../cron/contracts.ts';
import { listCronRuns } from '../../cron/runs.ts';
import { publicProcedure } from '../trpc.ts';

export const listCronRunsRoute = publicProcedure
    .input(listCronRunsInputSchema)
    .output(cronJobRunListSchema)
    .query(({ input }) => listCronRuns(input));
