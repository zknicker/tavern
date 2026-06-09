import {
    agentRuntimeCancelModelProviderOAuthSchema,
    agentRuntimeModelProviderOAuthCancelSchema,
} from '@tavern/api';
import { cancelModelProviderOAuth } from '../../model-access/service.ts';
import { publicProcedure } from '../trpc.ts';

export const cancelModelProviderOAuthProcedure = publicProcedure
    .input(agentRuntimeCancelModelProviderOAuthSchema)
    .mutation(async ({ input }) =>
        agentRuntimeModelProviderOAuthCancelSchema.parse(await cancelModelProviderOAuth(input))
    );
