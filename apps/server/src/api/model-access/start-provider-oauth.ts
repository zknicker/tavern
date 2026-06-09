import {
    agentRuntimeModelProviderOAuthStartSchema,
    agentRuntimeStartModelProviderOAuthSchema,
} from '@tavern/api';
import { startModelProviderOAuth } from '../../model-access/service.ts';
import { publicProcedure } from '../trpc.ts';

export const startModelProviderOAuthProcedure = publicProcedure
    .input(agentRuntimeStartModelProviderOAuthSchema)
    .mutation(async ({ input }) =>
        agentRuntimeModelProviderOAuthStartSchema.parse(await startModelProviderOAuth(input))
    );
