import { archiveChatInputSchema } from '../../chat/contracts.ts';
import { archiveTavernChat } from '../../chat/save.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const archiveChatRoute = publicProcedure
    .input(archiveChatInputSchema)
    .mutation(async ({ input }) => {
        const result = await archiveTavernChat(input.chatId);
        emitChatUpdated({ chatId: input.chatId });
        return result;
    });
