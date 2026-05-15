import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getSessionLogPage } from '../../sessions/log-page.ts';
import { publicProcedure } from '../trpc.ts';

const listSessionLogInputSchema = z.object({
    sessionKey: z.string().trim().min(1),
    limit: z.number().int().positive().max(100).default(50),
    offset: z.number().int().nonnegative().default(0),
});

export const listSessionLogRoute = publicProcedure
    .input(listSessionLogInputSchema)
    .query(async ({ input }) => {
        const result = await getSessionLogPage(input);

        if (!result) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `No stored session "${input.sessionKey}" was found.`,
            });
        }

        return result;
    });
