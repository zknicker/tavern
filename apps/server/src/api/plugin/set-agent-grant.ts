import { agentRuntimePluginIdSchema, agentRuntimeUpdateAgentPluginGrantSchema } from '@tavern/api';
import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { getActiveRuntimeId } from '../../storage/agent-runtime-connections.ts';
import { syncAgentsForRuntime } from '../../storage/agents.ts';
import { emitAgentInvalidationCascade } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const setAgentPluginGrantInputSchema = z.object({
    agentId: z.string().trim().min(1),
    enabled: agentRuntimeUpdateAgentPluginGrantSchema.shape.enabled,
    pluginId: agentRuntimePluginIdSchema,
});

export const setAgentPluginGrantProcedure = publicProcedure
    .input(setAgentPluginGrantInputSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        const runtimeId = await getActiveRuntimeId();
        if (!(client && runtimeId)) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            const grant = await client.setAgentPluginGrant(input.agentId, input.pluginId, {
                enabled: input.enabled,
            });
            await syncAgentsForRuntime({
                agents: (await client.listAgents()).agents,
                runtimeId,
            });
            emitAgentInvalidationCascade();
            return grant;
        } finally {
            client.close();
        }
    });
