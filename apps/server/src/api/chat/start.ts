import { startChatInputSchema } from '../../chat/contracts.ts';
import { startTavernChat } from '../../chat/start.ts';
import { emitSyncDataUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const startChatRoute = publicProcedure
    .input(startChatInputSchema)
    .mutation(async ({ input }) => {
        const result = await startTavernChat(input);
        emitSyncDataUpdated();
        return result;
    });
