import { runtimeUserIdSchema } from '@tavern/api';
import { z } from 'zod';
import { removeIdentityMember } from '../../identity/members.ts';
import { publicProcedure } from '../trpc.ts';

export const removeIdentityMemberProcedure = publicProcedure
    .input(z.object({ userId: runtimeUserIdSchema }))
    .mutation(async ({ ctx, input }) => removeIdentityMember(ctx, input.userId));
