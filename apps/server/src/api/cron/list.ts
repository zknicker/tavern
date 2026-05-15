import { listCronJobs } from '../../cron/list.ts';
import { publicProcedure } from '../trpc.ts';

export const listCronJobsRoute = publicProcedure.query(async () => {
    return await listCronJobs();
});
