import { getChatInputSchema } from '../../chat/contracts.ts';
import { getChat } from '../../chat/list.ts';
import { resolveActingUserId } from '../../identity/acting-user.ts';
import { publicProcedure } from '../trpc.ts';

export const getChatRoute = publicProcedure
    .input(getChatInputSchema)
    .query(async ({ ctx, input }) => getChat(input, await resolveActingUserId(ctx)));
