import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

// Agent activity feed (specs/agent-activity.md): a bounded, on-demand read
// proxied from Runtime's projection. Absent without a reachable Runtime,
// like presence.
export const agentActivityFeedRoute = publicProcedure
    .input(
        z.object({
            agentId: z.string().trim().min(1),
            limit: z.number().int().min(1).max(50).optional(),
        })
    )
    .query(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            return { entries: [] };
        }
        try {
            return await client.listAgentActivity(input.agentId, input.limit);
        } finally {
            client.close();
        }
    });
