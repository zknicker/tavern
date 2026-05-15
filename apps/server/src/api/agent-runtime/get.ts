import { getAgentRuntimeConnection } from '../../agent-runtime-connection/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getAgentRuntimeRoute = publicProcedure.query(async () => {
    return await getAgentRuntimeConnection();
});
