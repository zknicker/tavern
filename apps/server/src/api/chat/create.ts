import { createChatInputSchema, createChatResultSchema } from '../../chat/contracts.ts';
import { createTavernChat } from '../../chat/save.ts';
import { resolveActingUserId } from '../../identity/acting-user.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const createChatRoute = publicProcedure
    .input(createChatInputSchema)
    .mutation(async ({ ctx, input }) => {
        const result = createChatResultSchema.parse(
            await createTavernChat(input, await resolveActingUserId(ctx))
        );
        emitChatUpdated({ chatId: result.chatId });
        return result;
    });
