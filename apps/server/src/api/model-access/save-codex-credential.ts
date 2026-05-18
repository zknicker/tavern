import { agentRuntimeSaveCodexCredentialSchema } from '@tavern/api';
import { saveCodexCredential } from '../../model-access/service.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const saveCodexCredentialProcedure = publicProcedure
    .input(agentRuntimeSaveCodexCredentialSchema)
    .mutation(async ({ input }) => {
        const status = await saveCodexCredential(input);

        emitModelUpdated();

        return status;
    });
