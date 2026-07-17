import { runtimeInviteRedeemRequestSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

/** Redeems a runtime invite as the signed-in user, turning them into a member. */
export const redeemInviteProcedure = publicProcedure
    .input(runtimeInviteRedeemRequestSchema)
    .mutation(async ({ ctx, input }) => {
        if (!ctx.clerkSessionToken) {
            throw new Error('Sign in to redeem an invite.');
        }
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }
        try {
            await client.redeemIdentityInvite(ctx.clerkSessionToken, input.code);
            return { ok: true };
        } finally {
            client.close();
        }
    });
