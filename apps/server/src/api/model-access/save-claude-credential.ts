import { agentRuntimeSaveClaudeCredentialSchema } from '@tavern/api';
import { saveClaudeCredential } from '../../model-access/service.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const saveClaudeCredentialProcedure = publicProcedure
    .input(agentRuntimeSaveClaudeCredentialSchema)
    .mutation(async ({ input }) => {
        const status = await saveClaudeCredential(input);

        emitModelUpdated();

        return status;
    });
