import {
    agentRuntimeModelProviderOAuthSubmitSchema,
    agentRuntimeSubmitModelProviderOAuthSchema,
} from '@tavern/api';
import { submitModelProviderOAuth } from '../../model-access/service.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const submitModelProviderOAuthProcedure = publicProcedure
    .input(agentRuntimeSubmitModelProviderOAuthSchema)
    .mutation(async ({ input }) => {
        const result = agentRuntimeModelProviderOAuthSubmitSchema.parse(
            await submitModelProviderOAuth(input)
        );
        if (result.status === 'approved') {
            emitModelUpdated();
        }
        return result;
    });
