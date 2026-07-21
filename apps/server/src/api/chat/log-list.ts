import { z } from 'zod';
import { getChatLogPage } from '../../chat/log.ts';
import { publicProcedure } from '../trpc.ts';

const listChatLogInputSchema = z.object({
    cursor: z
        .union([
            z.number().int().positive(),
            z.object({
                beforeSequence: z.number().int().positive(),
            }),
        ])
        .optional(),
    id: z.string().min(1),
    limit: z.number().int().positive().max(100),
});

export const listChatLogRoute = publicProcedure
    .input(listChatLogInputSchema)
    .query(async ({ ctx, input }) => await getChatLogPage(input, ctx));
