import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

/**
 * Resolves the signed-in user's runtime identity (tavern user + member role).
 * The runtime is authoritative: it verifies the forwarded Clerk token, mints
 * the tavern user, and claims ownership on first connect. Returns null when
 * no session token was sent (keyless dev) or no runtime is connected.
 */
export const identityMeProcedure = publicProcedure.query(async ({ ctx }) => {
    if (!ctx.clerkSessionToken) {
        return null;
    }
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        return null;
    }
    try {
        return await client.getIdentityMe(ctx.clerkSessionToken);
    } finally {
        client.close();
    }
});
