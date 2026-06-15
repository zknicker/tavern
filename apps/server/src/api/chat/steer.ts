import { steerChatTurnInputSchema } from '../../chat/contracts.ts';
import { steerTavernChatTurn } from '../../chat/steer.ts';
import { publicProcedure } from '../trpc.ts';

export const steerChatTurnRoute = publicProcedure
    .input(steerChatTurnInputSchema)
    .mutation(async ({ input }) => await steerTavernChatTurn(input));
