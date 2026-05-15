import { listSubAgents } from '../../agents/sub-agents.ts';
import { publicProcedure } from '../trpc.ts';

export const listSubAgentsRoute = publicProcedure.query(async () => {
    return {
        subAgents: await listSubAgents(),
    };
});
