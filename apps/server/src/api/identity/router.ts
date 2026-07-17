import { createRouter } from '../trpc.ts';
import { identityMeProcedure } from './me.ts';
import { redeemInviteProcedure } from './redeem-invite.ts';

export const identityRouter = createRouter({
    me: identityMeProcedure,
    redeemInvite: redeemInviteProcedure,
});
