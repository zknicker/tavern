import { startChatAgentSessionInputSchema } from '../../chat/contracts.ts';
import { startTavernChatAgentSession } from '../../chat/start-agent-session.ts';
import { emitChatUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const startChatAgentSessionRoute = publicProcedure
    .input(startChatAgentSessionInputSchema)
    .mutation(async ({ input }) => {
        const result = await startTavernChatAgentSession(input);
        emitChatUpdated({ chatId: result.chatId });
        return result;
    });
