import { TRPCError } from '@trpc/server';
import { recordCapabilitySuccess } from '../../agent-runtime/capability-status.ts';
import { refreshAgentRuntimeEventSync } from '../../agent-runtime/event-sync.ts';
import { agentRuntimeConnectionInputSchema } from '../../agent-runtime-connection/contracts.ts';
import { refreshOpenClawGatewayCapability } from '../../agent-runtime-connection/openclaw-gateway-capability.ts';
import {
    checkAgentRuntimeConnection,
    getAgentRuntimeConnection,
    saveAgentRuntimeConnection,
} from '../../agent-runtime-connection/service.ts';
import { recordTavernPluginCapability } from '../../agent-runtime-connection/tavern-plugin-capability.ts';
import { syncMessagingBindingsToAgentRuntime } from '../../messaging-platform/service.ts';
import { listAgentRuntimeCapabilityStatuses } from '../../storage/agent-runtime-capability-status.ts';
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
        let baseUrl = normalizeBaseUrl(input.baseUrl);
        let checked: Awaited<ReturnType<typeof checkAgentRuntimeConnection>>;

        try {
            checked = await checkAgentRuntimeConnection({ auth: input.auth, baseUrl });
            baseUrl = checked.baseUrl;
        } catch (error) {
            const message = toErrorMessage(error);

            throw new TRPCError({
                code: 'BAD_REQUEST',
                message,
            });
        }

        try {
            const connection = await saveAgentRuntimeConnection({
                auth: input.auth,
                baseUrl,
                enabled: input.enabled,
                id: input.id,
                lastError: null,
            });
            if (connection) {
                await recordCapabilitySuccess({
                    capability: 'status',
                    method: 'health/status',
                    runtimeId: connection.id,
                });
                await recordTavernPluginCapability({
                    runtimeId: connection.id,
                    status: checked.status,
                });
                await refreshOpenClawGatewayCapability(connection.id);
                connection.capabilities = await listAgentRuntimeCapabilityStatuses(connection.id);
            }

            refreshAgentRuntimeEventSync();
            void syncMessagingBindingsToAgentRuntime().catch((error) => {
                console.warn('[tavern] failed to sync runtime messaging bindings', error);
            });
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
