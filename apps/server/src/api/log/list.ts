import { listLogs } from '../../storage/logs.ts';
import { publicProcedure } from '../trpc.ts';

export const listLogsRoute = publicProcedure.query(async () => {
    return {
        logs: await listLogs(),
    };
});
