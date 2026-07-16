import { markChatReadInputSchema, markTavernChatRead } from '../../chat/read.ts';
import { publicProcedure } from '../trpc.ts';

export const markChatReadRoute = publicProcedure
    .input(markChatReadInputSchema)
    .mutation(async ({ input }) => await markTavernChatRead(input));
