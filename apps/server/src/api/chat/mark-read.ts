import { markChatReadInputSchema, markTavernChatRead } from '../../chat/read.ts';
import { publicProcedure } from '../trpc.ts';

export const markChatReadRoute = publicProcedure
    .input(markChatReadInputSchema)
    .mutation(async ({ ctx, input }) => await markTavernChatRead(input, ctx));
