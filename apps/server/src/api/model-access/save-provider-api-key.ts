import { agentRuntimeSaveModelProviderApiKeySchema } from '@tavern/api';
import { saveModelProviderApiKey } from '../../model-access/service.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const saveModelProviderApiKeyProcedure = publicProcedure
    .input(agentRuntimeSaveModelProviderApiKeySchema)
    .mutation(async ({ input }) => {
        const result = await saveModelProviderApiKey(input);
        emitModelUpdated();
        return result;
    });
