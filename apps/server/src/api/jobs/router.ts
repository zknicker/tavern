import { createRouter } from '../trpc.ts';
import { getJobRoute } from './get.ts';
import { listJobsRoute } from './list.ts';
import { onJobsUpdate } from './on-update.ts';
import { recentRunsRoute } from './recent-runs.ts';
import { runJobRoute } from './run.ts';

export const jobsRouter = createRouter({
    get: getJobRoute,
    list: listJobsRoute,
    onUpdate: onJobsUpdate,
    recentRuns: recentRunsRoute,
    run: runJobRoute,
});
