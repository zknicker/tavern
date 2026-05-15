import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getSessionDetail } from '../../sessions/detail.ts';
import { publicProcedure } from '../trpc.ts';

const getSessionInputSchema = z.object({
    sessionKey: z.string().trim().min(1),
    limit: z.number().int().positive().max(100).default(10),
    offset: z.number().int().nonnegative().default(0),
});

export const getSessionRoute = publicProcedure
    .input(getSessionInputSchema)
    .query(async ({ input }) => {
        const result = await getSessionDetail(input);

        if (!result) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `No stored session "${input.sessionKey}" was found.`,
            });
        }

        return result;
    });
