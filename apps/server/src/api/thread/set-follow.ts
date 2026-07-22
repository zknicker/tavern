import { z } from 'zod';
import { setTavernThreadFollow } from '../../chat/thread-follow.ts';
import { publicProcedure } from '../trpc.ts';

const setThreadFollowInputSchema = z
    .object({
        follow: z.boolean(),
        threadChatId: z.string().trim().min(1),
    })
    .strict();

export const setThreadFollowRoute = publicProcedure
    .input(setThreadFollowInputSchema)
    .mutation(async ({ ctx, input }) => await setTavernThreadFollow(input, ctx));
