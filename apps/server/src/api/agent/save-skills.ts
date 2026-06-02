import { z } from 'zod';
import { agentEnabledSkillIdsSchema, saveCatalogAgentSettings } from '../../agents/catalog.ts';
import { enqueueRuntimeSkillInventoryRefresh } from '../../skills/inventory-job.ts';
import { emitAgentInvalidationCascade } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const saveAgentSkillsInputSchema = z.object({
    agentId: z.string().trim().min(1),
    enabledSkillIds: agentEnabledSkillIdsSchema,
});

export const saveAgentSkillsProcedure = publicProcedure
    .input(saveAgentSkillsInputSchema)
    .mutation(async ({ input }) => {
        const agent = await saveCatalogAgentSettings(input);
        void enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
        emitAgentInvalidationCascade();
        return {
            agent,
        };
    });
