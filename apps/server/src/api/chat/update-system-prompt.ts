import { updateChatSystemPromptInputSchema } from '../../chat/contracts.ts';
import { updateTavernChatSystemPrompt } from '../../chat/save.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const updateChatSystemPromptRoute = publicProcedure
    .input(updateChatSystemPromptInputSchema)
    .mutation(async ({ input }) => {
        const result = await updateTavernChatSystemPrompt(input);
        emitChatUpdated({ chatId: input.chatId });
        return result;
    });
