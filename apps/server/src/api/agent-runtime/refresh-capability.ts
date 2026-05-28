import { TRPCError } from '@trpc/server';
import {
    agentRuntimeCapabilitySchema,
    agentRuntimeCapabilityStatusSchema,
} from '../../agent-runtime-connection/contracts.ts';
import { refreshAgentRuntimeCapability } from '../../agent-runtime-connection/service.ts';
import {
    emitAgentRuntimeCapabilityUpdated,
    emitAgentRuntimeUpdated,
} from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Failed to refresh Runtime capability.';
}

export const refreshAgentRuntimeCapabilityRoute = publicProcedure
    .input(agentRuntimeCapabilitySchema)
    .mutation(async ({ input }) => {
        try {
            const capability = await refreshAgentRuntimeCapability({
                capability: input,
            });
            emitAgentRuntimeCapabilityUpdated();
            emitAgentRuntimeUpdated();
            return agentRuntimeCapabilityStatusSchema.parse(capability);
        } catch (error) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: toErrorMessage(error),
            });
        }
    });
