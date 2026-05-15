import { z } from 'zod';
import { getChatLogPage } from '../../chat/log.ts';
import { publicProcedure } from '../trpc.ts';

const listChatLogInputSchema = z.object({
    id: z.string().min(1),
    limit: z.number().int().positive().max(100),
    offset: z.number().int().nonnegative().optional(),
});

export const listChatLogRoute = publicProcedure
    .input(listChatLogInputSchema)
    .query(async ({ input }) => await getChatLogPage(input));
