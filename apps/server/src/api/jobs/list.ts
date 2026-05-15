import { listJobs } from '../../jobs/service.ts';
import { publicProcedure } from '../trpc.ts';

export const listJobsRoute = publicProcedure.query(async () => {
    return listJobs();
});
