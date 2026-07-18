import { createIdentityInvite } from '../../identity/members.ts';
import { publicProcedure } from '../trpc.ts';

export const createIdentityInviteProcedure = publicProcedure.mutation(async ({ ctx }) =>
    createIdentityInvite(ctx)
);
