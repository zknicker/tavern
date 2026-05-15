import { z } from 'zod';
import { getSessionPrompt } from '../../sessions/prompt.ts';
import { publicProcedure } from '../trpc.ts';

const getSessionPromptInputSchema = z.object({
    sessionKey: z.string().trim().min(1),
});

export const getSessionPromptRoute = publicProcedure
    .input(getSessionPromptInputSchema)
    .query(async ({ input }) => getSessionPrompt(input));
