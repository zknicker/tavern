import { listIdentityMembers } from '../../identity/members.ts';
import { publicProcedure } from '../trpc.ts';

export const identityMembersProcedure = publicProcedure.query(async ({ ctx }) =>
    listIdentityMembers(ctx)
);
