import { createChatResultSchema, updateChatInputSchema } from '../../chat/contracts.ts';
import { updateTavernChat } from '../../chat/save.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const updateChatRoute = publicProcedure
    .input(updateChatInputSchema)
    .mutation(async ({ input }) => {
        const result = createChatResultSchema.parse(await updateTavernChat(input));
        emitChatUpdated({ chatId: input.chatId });
        return result;
    });
