import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

// Read-only inbox visibility (I4): pending targets, muted channels, and
// followed threads on the agent profile. Attention stays agent-owned —
// humans steer it by asking in chat, so this surface never mutates.
export const getAgentInboxRoute = publicProcedure
    .input(z.object({ agentId: z.string().trim().min(1) }))
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            return null;
        }
        try {
            return await client.getAgentInbox(input.agentId);
        } catch {
            // Volatile runtime state degrades to absence, never a stale cache.
            return null;
        } finally {
            client.close();
        }
    });
