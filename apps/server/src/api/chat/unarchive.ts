import { unarchiveChatInputSchema } from '../../chat/contracts.ts';
import { unarchiveTavernChat } from '../../chat/save.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const unarchiveChatRoute = publicProcedure
    .input(unarchiveChatInputSchema)
    .mutation(async ({ input }) => {
        const result = await unarchiveTavernChat(input.chatId);
        emitChatUpdated({ chatId: input.chatId });
        return result;
    });
