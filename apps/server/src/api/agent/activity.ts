import { listAgentActivity } from '../../agents/activity.ts';
import { publicProcedure } from '../trpc.ts';

export const listAgentActivityRoute = publicProcedure.query(async () => {
    return {
        activity: await listAgentActivity(),
    };
});
