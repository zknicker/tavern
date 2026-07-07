import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

// The agent drawer's session surface: read the seat's current Agent session
// in a chat, and start a fresh one. See specs/agent-drawer.md.
const agentSessionInputSchema = z.object({
    agentId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
});

export const getAgentSessionProcedure = publicProcedure
    .input(agentSessionInputSchema)
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.getCurrentAgentSession({
                agentId: input.agentId,
                chatId: input.chatId,
            });
        } finally {
            client.close();
        }
    });

export const resetAgentSessionProcedure = publicProcedure
    .input(agentSessionInputSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.resetAgentSession(input.chatId, { agentId: input.agentId });
        } finally {
            client.close();
        }
    });
