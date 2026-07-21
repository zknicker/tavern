import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';
import { startGoogleOAuthLoopback } from './google-oauth-loopback.ts';

export const startGoogleOAuthProcedure = publicProcedure.mutation(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Grotto Runtime is not connected.');
    }

    try {
        return await startGoogleOAuthLoopback(client);
    } finally {
        client.close();
    }
});
