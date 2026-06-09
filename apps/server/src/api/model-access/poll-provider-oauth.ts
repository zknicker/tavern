import {
    agentRuntimeModelProviderOAuthPollSchema,
    agentRuntimePollModelProviderOAuthSchema,
} from '@tavern/api';
import { pollModelProviderOAuth } from '../../model-access/service.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const pollModelProviderOAuthProcedure = publicProcedure
    .input(agentRuntimePollModelProviderOAuthSchema)
    .query(async ({ input }) => {
        const result = agentRuntimeModelProviderOAuthPollSchema.parse(
            await pollModelProviderOAuth(input)
        );
        if (result.status === 'approved') {
            emitModelUpdated();
        }
        return result;
    });
