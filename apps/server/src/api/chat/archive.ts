import { archiveChatInputSchema } from '../../chat/contracts.ts';
import { archiveTavernChat } from '../../chat/save.ts';
import { emitSyncDataUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const archiveChatRoute = publicProcedure
    .input(archiveChatInputSchema)
    .mutation(async ({ input }) => {
        const result = await archiveTavernChat(input.chatId);
        emitSyncDataUpdated();
        return result;
    });
