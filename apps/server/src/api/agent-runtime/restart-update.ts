import { agentRuntimeUpdateSchema } from '@tavern/api';
import { restartAgentRuntimeForUpdate } from '../../agent-runtime-connection/service.ts';
import { publicProcedure } from '../trpc.ts';

export const restartAgentRuntimeUpdateRoute = publicProcedure.mutation(async () => {
    return agentRuntimeUpdateSchema.parse(await restartAgentRuntimeForUpdate());
});
