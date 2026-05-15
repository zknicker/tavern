import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { resyncSession } from '../../sessions/resync.ts';
import { publicProcedure } from '../trpc.ts';

const resyncSessionInputSchema = z.object({
    sessionKey: z.string().trim().min(1),
});

export const resyncSessionRoute = publicProcedure
    .input(resyncSessionInputSchema)
    .mutation(async ({ input }) => {
        const result = await resyncSession(input);

        if (!result) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `No stored session "${input.sessionKey}" was found.`,
            });
        }

        return result;
    });
