import { listSessionSummaries } from '../../sessions/list.ts';
import { publicProcedure } from '../trpc.ts';

export const listSessionsRoute = publicProcedure.query(async () => {
    return {
        sessions: await listSessionSummaries(),
    };
});
