import { listIdentityInvites } from '../../identity/members.ts';
import { publicProcedure } from '../trpc.ts';

export const identityInvitesProcedure = publicProcedure.query(async ({ ctx }) =>
    listIdentityInvites(ctx)
);
