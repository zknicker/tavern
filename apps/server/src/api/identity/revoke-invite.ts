import { z } from 'zod';
import { revokeIdentityInvite } from '../../identity/members.ts';
import { publicProcedure } from '../trpc.ts';

export const revokeIdentityInviteProcedure = publicProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => revokeIdentityInvite(ctx, input.id));
