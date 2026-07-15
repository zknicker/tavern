import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

// The agent drawer's read-only session view: the agent's current global
// session as seen from one chat. See specs/agent-drawer.md.
const agentSessionInputSchema = z.object({
    agentId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
});

// Manual reset contract (specs/sessions.md): agent-scoped, human-initiated,
// lives in agent settings. 'session' starts fresh context (workspace and
// memory persist); 'full' also wipes the workspace.
const agentSessionResetInputSchema = z.object({
    agentId: z.string().trim().min(1),
    kind: z.enum(['full', 'session']).default('session'),
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
    .input(agentSessionResetInputSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            // Sessions are agent-global (specs/sessions.md): the reset
            // applies to the agent everywhere, not one chat.
            return await client.resetAgentSession(input.agentId, { kind: input.kind });
        } finally {
            client.close();
        }
    });
