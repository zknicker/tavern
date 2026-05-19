import { getChatInputSchema } from '../../chat/contracts.ts';
import { getChat } from '../../chat/list.ts';
import { publicProcedure } from '../trpc.ts';

export const getChatRoute = publicProcedure
    .input(getChatInputSchema)
    .query(async ({ input }) => await getChat(input));
