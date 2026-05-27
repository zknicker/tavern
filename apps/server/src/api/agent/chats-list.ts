import { z } from 'zod';
import { listAgentChats } from '../../agents/chats.ts';
import { publicProcedure } from '../trpc.ts';

const listAgentChatsInputSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const listAgentChatsRoute = publicProcedure
    .input(listAgentChatsInputSchema)
    .query(async ({ input }) => await listAgentChats(input));
