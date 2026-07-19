import { createRouter } from '../trpc.ts';
import { createIdentityInviteProcedure } from './create-invite.ts';
import { identityInvitesProcedure } from './invites.ts';
import { identityMeProcedure } from './me.ts';
import { identityMembersProcedure } from './members.ts';
import { pushSessionTokenProcedure } from './push-session-token.ts';
import { redeemInviteProcedure } from './redeem-invite.ts';
import { removeIdentityMemberProcedure } from './remove-member.ts';
import { revokeIdentityInviteProcedure } from './revoke-invite.ts';

export const identityRouter = createRouter({
    createInvite: createIdentityInviteProcedure,
    invites: identityInvitesProcedure,
    me: identityMeProcedure,
    members: identityMembersProcedure,
    pushSessionToken: pushSessionTokenProcedure,
    redeemInvite: redeemInviteProcedure,
    removeMember: removeIdentityMemberProcedure,
    revokeInvite: revokeIdentityInviteProcedure,
});
