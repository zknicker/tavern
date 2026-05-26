import { createChatInputSchema, createChatResultSchema } from '../../chat/contracts.ts';
import { createTavernChat } from '../../chat/save.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const createChatRoute = publicProcedure
    .input(createChatInputSchema)
    .mutation(async ({ input }) => {
        const result = createChatResultSchema.parse(await createTavernChat(input));
        emitChatUpdated({ chatId: result.chatId });
        return result;
    });
