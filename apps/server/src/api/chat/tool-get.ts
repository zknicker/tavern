import { z } from 'zod';
import { getChatToolActivity } from '../../chat/tool.ts';
import { publicProcedure } from '../trpc.ts';

const getChatToolInputSchema = z.object({
    activityId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
});

export const getChatToolRoute = publicProcedure
    .input(getChatToolInputSchema)
    .query(async ({ input }) => await getChatToolActivity(input));
