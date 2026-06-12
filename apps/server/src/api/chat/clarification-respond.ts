import { respondToTavernChatClarification } from '../../chat/clarification.ts';
import { respondToChatClarificationInputSchema } from '../../chat/contracts.ts';
import { publicProcedure } from '../trpc.ts';

export const respondToChatClarificationRoute = publicProcedure
    .input(respondToChatClarificationInputSchema)
    .mutation(async ({ input }) => await respondToTavernChatClarification(input));
