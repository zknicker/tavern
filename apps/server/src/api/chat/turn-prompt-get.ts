import { z } from 'zod';
import { getChatTurnPrompt } from '../../chat/turn-prompt.ts';
import { publicProcedure } from '../trpc.ts';

const getChatTurnPromptInputSchema = z.object({
    runId: z.string().regex(/^run_[A-Za-z0-9_-]+$/),
});

export const getChatTurnPromptRoute = publicProcedure
    .input(getChatTurnPromptInputSchema)
    .query(async ({ input }) => await getChatTurnPrompt(input.runId));
