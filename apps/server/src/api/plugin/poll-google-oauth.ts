import { agentRuntimeGoogleOAuthPollInputSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';
import { closeGoogleOAuthLoopback } from './google-oauth-loopback.ts';

export const pollGoogleOAuthProcedure = publicProcedure
    .input(agentRuntimeGoogleOAuthPollInputSchema)
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }

        try {
            const result = await client.pollGoogleOAuth(input);
            if (result.status !== 'pending') {
                closeGoogleOAuthLoopback(input.sessionId);
            }
            return result;
        } finally {
            client.close();
        }
    });
