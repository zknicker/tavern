import { createRouter } from '../trpc.ts';
import { listLogsRoute } from './list.ts';

export const logRouter = createRouter({
    list: listLogsRoute,
});
