import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const disconnectGoogleOAuthProcedure = publicProcedure.mutation(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Grotto Runtime is not connected.');
    }

    try {
        return await client.disconnectGoogleOAuth();
    } finally {
        client.close();
    }
});
