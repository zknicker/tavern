import {
    agentRuntimeCurrentAgentSessionResultSchema,
    agentRuntimeMacAppListSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeStartAgentSessionResultSchema,
    agentRuntimeStartAgentSessionSchema,
    agentRuntimeUpdateAgentSessionModelResultSchema,
    agentRuntimeUpdateAgentSessionModelSchema,
    agentRuntimeUpdateRequestSchema,
    agentRuntimeUpdateSchema,
    runtimeEventListSchema,
    runtimeHealthSchema,
    runtimeRoutes,
} from '@tavern/api';
import { handleAgentEnvRequest } from '../agent-engine/agent-env-routes';
import { handleCommandsRequest } from '../agent-engine/command-routes';
import { handleExecutionSettingsRequest } from '../agent-engine/execution-settings';
import { handleMcpRequest } from '../agent-engine/mcp-routes';
import { handleMcpServersRequest } from '../agent-engine/mcp-server-routes';
import { handleSkillHubRequest } from '../agent-engine/skill-hub-routes';
import { handleToolSetupRequest } from '../agent-engine/tool-setup-routes';
import { handleRuntimeCapabilitiesRequest } from '../capabilities/routes';
import { handleRuntimeJobsRequest } from '../jobs/routes';
import { listMacApps } from '../mac-apps/inventory';
import { handleModelAccessRequest } from '../model-access/model-access';
import { handleOpenAiSettingsRequest } from '../model-access/openai-settings';
import { handleOpenRouterSettingsRequest } from '../model-access/openrouter-settings';
import { handlePluginsRequest } from '../plugins/routes';
import { handleVaultRequest } from '../vault/routes';
import { handleWorkspaceRequest } from '../workspace/routes';
import {
    readCurrentAgentSession,
    startNewAgentSession,
    updateCurrentAgentSessionModel,
} from './agent-session-store';
import { createMessage } from './chat-api';
import { handleTavernApiRequest } from './chat-api-router';
import { deliverAgentCronToTavernChat } from './cron-delivery';
import { forbidden, json, notFound, readJson } from './http';
import { handleAgentProxyRequest } from './proxy';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';
import { getRuntimeHealth } from './status';
import { getRuntimeUpdateStatus, restartRuntimeForUpdate, startRuntimeUpdate } from './update';

export async function handleTavernRuntimeRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const apiResponse = await handleTavernApiRequest(request);
    if (apiResponse) {
        return apiResponse;
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.macApps) {
        return json(
            agentRuntimeMacAppListSchema.parse({
                apps: await listMacApps({
                    limit: Number(url.searchParams.get('limit') ?? 80),
                    query: url.searchParams.get('query') ?? '',
                }),
            })
        );
    }

    if (request.method === 'POST' && url.pathname === '/cron/deliveries') {
        const receipt = deliverAgentCronToTavernChat(await readJson(request));
        return json(
            {
                chat_id: receipt.message.chat_id,
                cursor: receipt.cursor,
                idempotent: receipt.idempotent,
                message_id: receipt.message.id,
                success: true,
            },
            receipt.idempotent ? 200 : 201
        );
    }

    const vaultResponse = await handleVaultRequest(request);
    if (vaultResponse) {
        return vaultResponse;
    }

    const jobsResponse = await handleRuntimeJobsRequest(request);
    if (jobsResponse) {
        return jobsResponse;
    }

    const modelAccessResponse = await handleModelAccessRequest(request);
    if (modelAccessResponse) {
        return modelAccessResponse;
    }

    const openAiSettingsResponse = await handleOpenAiSettingsRequest(request);
    if (openAiSettingsResponse) {
        return openAiSettingsResponse;
    }

    const openRouterSettingsResponse = await handleOpenRouterSettingsRequest(request);
    if (openRouterSettingsResponse) {
        return openRouterSettingsResponse;
    }

    const executionSettingsResponse = await handleExecutionSettingsRequest(request);
    if (executionSettingsResponse) {
        return executionSettingsResponse;
    }

    const agentEnvResponse = await handleAgentEnvRequest(request);
    if (agentEnvResponse) {
        return agentEnvResponse;
    }

    const mcpServersResponse = await handleMcpServersRequest(request);
    if (mcpServersResponse) {
        return mcpServersResponse;
    }

    const pluginsResponse = await handlePluginsRequest(request);
    if (pluginsResponse) {
        return pluginsResponse;
    }

    const commandsResponse = await handleCommandsRequest(request);
    if (commandsResponse) {
        return commandsResponse;
    }

    const skillHubResponse = await handleSkillHubRequest(request);
    if (skillHubResponse) {
        return skillHubResponse;
    }

    const toolSetupResponse = await handleToolSetupRequest(request);
    if (toolSetupResponse) {
        return toolSetupResponse;
    }

    const mcpResponse = await handleMcpRequest(request);
    if (mcpResponse) {
        return mcpResponse;
    }

    const capabilitiesResponse = await handleRuntimeCapabilitiesRequest(request);
    if (capabilitiesResponse) {
        return capabilitiesResponse;
    }

    const workspaceResponse = await handleWorkspaceRequest(request);
    if (workspaceResponse) {
        return workspaceResponse;
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.health) {
        return json(runtimeHealthSchema.parse(getRuntimeHealth()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.update) {
        if (
            request.headers.get(agentRuntimeMutationHeaders.origin) !==
            agentRuntimeMutationOrigins.tavern
        ) {
            return forbidden('Runtime update requires a Tavern caller.');
        }
        return json(
            agentRuntimeUpdateSchema.parse(
                startRuntimeUpdate(agentRuntimeUpdateRequestSchema.parse(await readJson(request)))
            )
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.updateStatus) {
        return json(agentRuntimeUpdateSchema.parse(getRuntimeUpdateStatus()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.updateRestart) {
        if (
            request.headers.get(agentRuntimeMutationHeaders.origin) !==
            agentRuntimeMutationOrigins.tavern
        ) {
            return forbidden('Runtime restart requires a Tavern caller.');
        }
        return json(agentRuntimeUpdateSchema.parse(restartRuntimeForUpdate()));
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.events) {
        const limit = Number(url.searchParams.get('limit') ?? 500);
        const afterCursor = Number(url.searchParams.get('after_cursor') ?? 0);
        return json(
            runtimeEventListSchema.parse({
                events: listProjectedTavernRuntimeEvents({
                    afterCursor: Number.isFinite(afterCursor) ? afterCursor : 0,
                    limit: Number.isFinite(limit) ? limit : 500,
                }).map((entry) => entry.event),
            })
        );
    }

    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (
        request.method === 'POST' &&
        segments[0] === 'agent' &&
        segments[1] === 'chats' &&
        segments[2] &&
        segments[3] === 'agent-sessions' &&
        segments[4] === 'new'
    ) {
        const input = agentRuntimeStartAgentSessionSchema.parse(await readJson(request));
        const session = startNewAgentSession({
            agentParticipantId: input.agentParticipantId,
            chatId: segments[2],
        });
        createMessage(segments[2], {
            author_id: 'sys_tavern',
            content: `Started new session: ${session.id}`,
            id: sessionNoticeMessageId(session.id),
            metadata: {
                tavern: {
                    agentParticipantId: session.agentParticipantId,
                    kind: 'new_session',
                    sessionId: session.id,
                },
            },
            role: 'system',
        });
        return json(
            agentRuntimeStartAgentSessionResultSchema.parse({
                session,
            })
        );
    }

    if (
        request.method === 'PATCH' &&
        segments[0] === 'agent' &&
        segments[1] === 'chats' &&
        segments[2] &&
        segments[3] === 'agent-sessions' &&
        segments[4] === 'model'
    ) {
        const input = agentRuntimeUpdateAgentSessionModelSchema.parse(await readJson(request));
        return json(
            agentRuntimeUpdateAgentSessionModelResultSchema.parse(
                updateCurrentAgentSessionModel({
                    agentParticipantId: input.agentParticipantId,
                    chatId: segments[2],
                    model: input.model,
                })
            )
        );
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'agent' &&
        segments[1] === 'chats' &&
        segments[2] &&
        segments[3] === 'agent-sessions' &&
        segments[4] === 'current'
    ) {
        return json(
            agentRuntimeCurrentAgentSessionResultSchema.parse({
                session: readCurrentAgentSession({
                    agentParticipantId: url.searchParams.get('agentParticipantId') ?? undefined,
                    chatId: segments[2],
                }),
            })
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.agents) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.chats) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.models) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.skills) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && segments[0] === 'skills' && segments[1] && !segments[2]) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (
        request.method === 'PUT' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'enabled'
    ) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessions) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessionPreviews) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    const agentSessionKey =
        segments[0] === 'agent' && segments[1] === 'sessions' ? segments[2] : null;
    if (agentSessionKey && request.method === 'GET' && segments[3] === 'messages') {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (agentSessionKey && request.method === 'GET' && segments[3] === 'graph') {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (agentSessionKey && request.method === 'POST' && segments[3] === 'resync') {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    const proxyResponse = await handleAgentProxyRequest(request);

    return proxyResponse ?? notFound();
}

function sessionNoticeMessageId(sessionId: string) {
    return `msg_${sessionId}_notice`.replace(/[^A-Za-z0-9_-]/g, '_');
}
