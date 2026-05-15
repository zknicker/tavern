import { sendChatMessageInputSchema } from '../../chat/contracts.ts';
import { sendTavernChatMessage } from '../../chat/send.ts';
import { publicProcedure } from '../trpc.ts';

export const sendChatMessageRoute = publicProcedure
    .input(sendChatMessageInputSchema)
    .mutation(async ({ input }) => await sendTavernChatMessage(input));
