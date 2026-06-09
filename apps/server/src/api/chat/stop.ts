import { stopChatTurnInputSchema } from '../../chat/contracts.ts';
import { stopTavernChatTurn } from '../../chat/stop.ts';
import { publicProcedure } from '../trpc.ts';

export const stopChatTurnRoute = publicProcedure
    .input(stopChatTurnInputSchema)
    .mutation(async ({ input }) => await stopTavernChatTurn(input));
