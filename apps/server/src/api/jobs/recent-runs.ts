import { listRecentRuns } from '../../jobs/service.ts';
import { publicProcedure } from '../trpc.ts';

export const recentRunsRoute = publicProcedure.query(async () => {
    return listRecentRuns();
});
