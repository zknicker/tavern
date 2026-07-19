import { setCurrentSessionToken } from '../../identity/session-token-store.ts';
import { publicProcedure } from '../trpc.ts';

export const pushSessionTokenProcedure = publicProcedure.mutation(({ ctx }) => {
    if (ctx.clerkSessionToken) {
        setCurrentSessionToken(ctx.clerkSessionToken);
    }

    return null;
});
