import { agentRuntimeUpdateSchema } from '@tavern/api';
import { startAgentRuntimeUpdate } from '../../agent-runtime-connection/service.ts';
import { publicProcedure } from '../trpc.ts';

export const startAgentRuntimeUpdateRoute = publicProcedure.mutation(async () => {
    return agentRuntimeUpdateSchema.parse(await startAgentRuntimeUpdate());
});
