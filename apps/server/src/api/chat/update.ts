import { createChatResultSchema, updateChatInputSchema } from '../../chat/contracts.ts';
import { updateTavernChat } from '../../chat/save.ts';
import { resolveActingUserId } from '../../identity/acting-user.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const updateChatRoute = publicProcedure
    .input(updateChatInputSchema)
    .mutation(async ({ ctx, input }) => {
        const result = createChatResultSchema.parse(
            await updateTavernChat(input, await resolveActingUserId(ctx))
        );
        emitChatUpdated({ chatId: input.chatId });
        return result;
    });
