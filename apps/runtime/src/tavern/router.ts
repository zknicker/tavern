import {
    agentRuntimeCurrentAgentSessionResultSchema,
    agentRuntimeMacAppListSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeResetAgentSessionResultSchema,
    agentRuntimeResetAgentSessionSchema,
    agentRuntimeRoutes,
    agentRuntimeSkillResetResultSchema,
    agentRuntimeUpdateRequestSchema,
    agentRuntimeUpdateSchema,
    runtimeEventListSchema,
    runtimeHealthSchema,
    runtimeRoutes,
} from '@tavern/api';
import { handleAgentEnvRequest } from '../agent-engine/agent-env-routes.ts';
import { handleMcpRequest } from '../agent-engine/mcp-routes.ts';
import { handleMcpServersRequest } from '../agent-engine/mcp-server-routes.ts';
import { handleSkillHubRequest } from '../agent-engine/skill-hub-routes.ts';
import { resetRuntimeSkillToDefault } from '../agent-engine/skill-library.ts';
import { handleToolSetupRequest } from '../agent-engine/tool-setup-routes.ts';
import { handleRuntimeCapabilitiesRequest } from '../capabilities/routes.ts';
import { handleCronRequest } from '../cron/routes.ts';
import { handleRuntimeJobsRequest } from '../jobs/routes.ts';
import { listMacApps } from '../mac-apps/inventory.ts';
import { handleMemoryRequest } from '../memory/routes.ts';
import { handleMemorySettingsRequest } from '../memory/settings.ts';
import { handleModelAccessRequest } from '../model-access/model-access.ts';
import { handleOpenAiSettingsRequest } from '../model-access/openai-settings.ts';
import { handleOpenRouterSettingsRequest } from '../model-access/openrouter-settings.ts';
import { handleModelCategorySettingsRequest } from '../models/category-settings.ts';
import { handleModelProviderRequest } from '../models/provider-routes.ts';
import { handlePluginsRequest } from '../plugins/routes.ts';
import { handleTaskLabelsRequest } from '../tasks/label-routes.ts';
import { handleTasksRequest } from '../tasks/routes.ts';
import { handleAutoDispatchSettingsRequest } from '../tasks/settings.ts';
import { handleTimezoneSettingsRequest } from '../timezone-settings.ts';
import { handleWikiRequest } from '../wiki/routes.ts';
import { handleWorkspaceRequest } from '../workspace/routes.ts';
import { agentSessionInstructionsFresh } from './agent-instructions.ts';
import { resetAgentSession } from './agent-session-reset.ts';
import { readAgentSessionStats, readPastAgentSessionSummaries } from './agent-session-stats.ts';
import { readCurrentAgentSession } from './agent-session-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { handleTavernApiRequest } from './chat-api-router.ts';
import { handleDevToolkitRequest } from './development-turn-simulator.ts';
import { badRequest, forbidden, json, notFound, readJson } from './http.ts';
import { handleAgentProxyRequest } from './proxy.ts';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection.ts';
import { getRuntimeHealth } from './status.ts';
import { getRuntimeUpdateStatus, restartRuntimeForUpdate, startRuntimeUpdate } from './update.ts';

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

    const wikiResponse = await handleWikiRequest(request);
    if (wikiResponse) {
        return wikiResponse;
    }

    const memoryResponse = await handleMemoryRequest(request);
    if (memoryResponse) {
        return memoryResponse;
    }

    const jobsResponse = await handleRuntimeJobsRequest(request);
    if (jobsResponse) {
        return jobsResponse;
    }

    const cronResponse = await handleCronRequest(request);
    if (cronResponse) {
        return cronResponse;
    }

    const autoDispatchSettingsResponse = await handleAutoDispatchSettingsRequest(request);
    if (autoDispatchSettingsResponse) {
        return autoDispatchSettingsResponse;
    }

    const tasksResponse = await handleTasksRequest(request);
    if (tasksResponse) {
        return tasksResponse;
    }

    const taskLabelsResponse = await handleTaskLabelsRequest(request);
    if (taskLabelsResponse) {
        return taskLabelsResponse;
    }

    const modelProviderResponse = await handleModelProviderRequest(request);
    if (modelProviderResponse) {
        return modelProviderResponse;
    }

    const modelAccessResponse = await handleModelAccessRequest(request);
    if (modelAccessResponse) {
        return modelAccessResponse;
    }

    const memorySettingsResponse = await handleMemorySettingsRequest(request);
    if (memorySettingsResponse) {
        return memorySettingsResponse;
    }

    const modelCategorySettingsResponse = await handleModelCategorySettingsRequest(request);
    if (modelCategorySettingsResponse) {
        return modelCategorySettingsResponse;
    }

    const openAiSettingsResponse = await handleOpenAiSettingsRequest(request);
    if (openAiSettingsResponse) {
        return openAiSettingsResponse;
    }

    const openRouterSettingsResponse = await handleOpenRouterSettingsRequest(request);
    if (openRouterSettingsResponse) {
        return openRouterSettingsResponse;
    }

    const timezoneSettingsResponse = await handleTimezoneSettingsRequest(request);
    if (timezoneSettingsResponse) {
        return timezoneSettingsResponse;
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

    const devToolkitResponse = await handleDevToolkitRequest(request);
    if (devToolkitResponse) {
        return devToolkitResponse;
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
        segments[4] === 'reset'
    ) {
        const input = agentRuntimeResetAgentSessionSchema.parse(await readJson(request));
        return json(
            agentRuntimeResetAgentSessionResultSchema.parse(
                resetAgentSession({
                    agentId: input.agentId,
                    chatId: segments[2],
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
        // Clients address agents by agent id; the seat's participant id is a
        // Runtime detail derived from it.
        const agentId = url.searchParams.get('agentId');
        const agentParticipantId = agentId ? createAgentParticipantId(agentId) : undefined;
        const session = readCurrentAgentSession({
            agentParticipantId,
            chatId: segments[2],
        });
        return json(
            agentRuntimeCurrentAgentSessionResultSchema.parse({
                instructionsFresh: session ? await agentSessionInstructionsFresh(session) : null,
                pastSessions: readPastAgentSessionSummaries({
                    agentParticipantId,
                    chatId: segments[2],
                    currentSessionId: session?.id ?? null,
                }),
                session,
                stats: session
                    ? readAgentSessionStats({ chatId: segments[2], sessionId: session.id })
                    : null,
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
        request.method === 'POST' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'reset'
    ) {
        try {
            const result = await resetRuntimeSkillToDefault(segments[1]);
            return json(agentRuntimeSkillResetResultSchema.parse(result));
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
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
