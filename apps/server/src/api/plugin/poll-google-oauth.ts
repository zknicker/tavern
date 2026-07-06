import { agentRuntimeGoogleOAuthPollInputSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const pollGoogleOAuthProcedure = publicProcedure
    .input(agentRuntimeGoogleOAuthPollInputSchema)
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.pollGoogleOAuth(input);
        } finally {
            client.close();
        }
    });
