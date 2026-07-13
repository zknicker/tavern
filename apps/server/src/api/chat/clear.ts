import { clearChatInputSchema } from '../../chat/contracts.ts';
import { clearTavernChat } from '../../chat/dismiss.ts';
import { publicProcedure } from '../trpc.ts';

export const clearChatRoute = publicProcedure
    .input(clearChatInputSchema)
    .mutation(async ({ input }) => await clearTavernChat(input.chatId));
