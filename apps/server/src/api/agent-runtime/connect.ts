import { TRPCError } from '@trpc/server';
import { refreshAgentRuntimeEventSync } from '../../agent-runtime/event-sync.ts';
import { agentRuntimeConnectionInputSchema } from '../../agent-runtime-connection/contracts.ts';
import {
    getAgentRuntimeConnection,
    saveAgentRuntimeConnection,
} from '../../agent-runtime-connection/service.ts';
import { syncMessagingBindingsToAgentRuntime } from '../../messaging-platform/service.ts';
import { enqueueRuntimeSkillInventoryRefresh } from '../../skills/inventory-job.ts';
import {
    emitAgentInvalidationCascade,
    emitAgentRuntimeUpdated,
    emitCronUpdated,
    emitSkillInvalidationCascade,
} from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

function normalizeBaseUrl(baseUrl: string) {
    const url = new URL(baseUrl.trim());

    if (url.protocol === 'ws:') {
        url.protocol = 'http:';
    }

    if (url.protocol === 'wss:') {
        url.protocol = 'https:';
    }

    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Failed to connect to Tavern Runtime.';
}

export const connectAgentRuntimeRoute = publicProcedure
    .input(agentRuntimeConnectionInputSchema)
    .mutation(async ({ input }) => {
        const baseUrl = normalizeBaseUrl(input.baseUrl);

        try {
            const connection = await saveAgentRuntimeConnection({
                auth: input.auth,
                baseUrl,
                enabled: input.enabled,
                id: input.id,
                lastError: null,
            });
            refreshAgentRuntimeEventSync();
            void syncMessagingBindingsToAgentRuntime().catch((error) => {
                console.warn('[tavern] failed to sync runtime messaging bindings', error);
            });
            void enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
            emitAgentInvalidationCascade();
            emitCronUpdated();
            emitAgentRuntimeUpdated();
            emitSkillInvalidationCascade();

            return connection ? ((await getAgentRuntimeConnection()) ?? connection) : connection;
        } catch (error) {
            const message = toErrorMessage(error);

            refreshAgentRuntimeEventSync();
            emitAgentInvalidationCascade();
            emitCronUpdated();
            emitAgentRuntimeUpdated();
            emitSkillInvalidationCascade();

            throw new TRPCError({
                code: 'BAD_REQUEST',
                message,
            });
        }
    });
