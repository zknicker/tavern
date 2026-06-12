import { dismissChatLogRowInputSchema } from '../../chat/contracts.ts';
import { dismissChatResponse } from '../../chat/dismiss.ts';
import { publicProcedure } from '../trpc.ts';

export const dismissChatLogRowRoute = publicProcedure
    .input(dismissChatLogRowInputSchema)
    .mutation(async ({ input }) => await dismissChatResponse(input));
