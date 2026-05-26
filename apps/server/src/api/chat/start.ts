import { startChatInputSchema } from '../../chat/contracts.ts';
import { startTavernChat } from '../../chat/start.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const startChatRoute = publicProcedure
    .input(startChatInputSchema)
    .mutation(async ({ input }) => {
        const result = await startTavernChat(input);
        emitChatUpdated({ chatId: result.chatId });
        return result;
    });
