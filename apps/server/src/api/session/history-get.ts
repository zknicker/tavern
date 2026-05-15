import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getSessionHistory } from '../../sessions/history.ts';
import { publicProcedure } from '../trpc.ts';

const getSessionHistoryInputSchema = z.object({
    sessionKey: z.string().trim().min(1),
    limit: z.number().int().positive().max(100).default(10),
    offset: z.number().int().nonnegative().optional(),
});

export const getSessionHistoryRoute = publicProcedure
    .input(getSessionHistoryInputSchema)
    .query(async ({ input }) => {
        const result = await getSessionHistory(input);

        if (!result) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `No stored session "${input.sessionKey}" was found.`,
            });
        }

        return result;
    });
