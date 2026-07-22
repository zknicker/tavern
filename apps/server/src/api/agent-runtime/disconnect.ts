import { clearAgentRuntimeConnection } from '../../agent-runtime-connection/service.ts';
import { emitAgentRuntimeUpdated, emitSkillInvalidationCascade } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const disconnectAgentRuntimeRoute = publicProcedure.mutation(async () => {
    await clearAgentRuntimeConnection({ clearEnvironmentOverride: true });
    emitAgentRuntimeUpdated();
    emitSkillInvalidationCascade();
    return { ok: true };
});
