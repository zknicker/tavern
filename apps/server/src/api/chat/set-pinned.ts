import { setChatPinnedInputSchema } from '../../chat/contracts.ts';
import { setTavernChatPinned } from '../../chat/save.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const setChatPinnedRoute = publicProcedure
    .input(setChatPinnedInputSchema)
    .mutation(async ({ input }) => {
        const result = await setTavernChatPinned(input);
        emitChatUpdated({ chatId: input.chatId });
        return result;
    });
