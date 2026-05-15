import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getSessionToolCall } from '../../sessions/tool-call.ts';
import { publicProcedure } from '../trpc.ts';

const getSessionToolInputSchema = z.object({
    sessionKey: z.string().trim().min(1),
    toolCallId: z.string().trim().min(1),
});

export const getSessionToolRoute = publicProcedure
    .input(getSessionToolInputSchema)
    .query(async ({ input }) => {
        const result = await getSessionToolCall(input);

        if (!result) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `No stored tool call "${input.toolCallId}" was found for session "${input.sessionKey}".`,
            });
        }

        return result;
    });
