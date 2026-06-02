import { agentRuntimeUpdateSchema } from '@tavern/api';
import { getAgentRuntimeUpdateStatus } from '../../agent-runtime-connection/service.ts';
import { publicProcedure } from '../trpc.ts';

export const getAgentRuntimeUpdateStatusRoute = publicProcedure.query(async () => {
    return agentRuntimeUpdateSchema.parse(await getAgentRuntimeUpdateStatus());
});
