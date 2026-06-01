import { updateChatTabAppearanceInputSchema } from '../../chat/contracts.ts';
import { updateTavernChatTabAppearance } from '../../chat/save.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const updateChatTabAppearanceRoute = publicProcedure
    .input(updateChatTabAppearanceInputSchema)
    .mutation(async ({ input }) => {
        const result = await updateTavernChatTabAppearance(input);
        emitChatUpdated({ chatId: input.chatId });
        return result;
    });
