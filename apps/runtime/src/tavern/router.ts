import {
    agentRuntimeHighlightListSchema,
    agentRuntimeMacAppListSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeUpdateRequestSchema,
    agentRuntimeUpdateSchema,
    runtimeEventListSchema,
    runtimeHealthSchema,
    runtimeRoutes,
} from '@tavern/api';
import { handleRuntimeCapabilitiesRequest } from '../capabilities/routes';
import { handleCortexRequest } from '../cortex/routes';
import { listTavernHighlights } from '../highlights/highlights';
import { handleRuntimeJobsRequest } from '../jobs/routes';
import { listMacApps } from '../mac-apps/inventory';
import { handleModelAccessRequest } from '../model-access/model-access';
import { handleOpenAiSettingsRequest } from '../model-access/openai-settings';
import { handleOpenRouterSettingsRequest } from '../model-access/openrouter-settings';
import { handleWorkspaceRequest } from '../workspace/routes';
import { handleTavernApiRequest } from './chat-api-router';
import { forbidden, json, notFound, readJson } from './http';
import { handleHermesProxyRequest } from './proxy';
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

    if (request.method === 'GET' && url.pathname === runtimeRoutes.highlights) {
        return json(agentRuntimeHighlightListSchema.parse(listTavernHighlights()));
    }

    const cortexResponse = await handleCortexRequest(request);
    if (cortexResponse) {
        return cortexResponse;
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
        return json(
            runtimeEventListSchema.parse({
                events: listProjectedTavernRuntimeEvents({
                    limit: Number.isFinite(limit) ? limit : 500,
                }).map((entry) => entry.event),
            })
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.agents) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.chats) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.models) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.skills) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessions) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessionPreviews) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (
        request.method === 'GET' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    const hermesSessionKey =
        segments[0] === 'hermes' && segments[1] === 'sessions' ? segments[2] : null;
    if (hermesSessionKey && request.method === 'GET' && segments[3] === 'messages') {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (hermesSessionKey && request.method === 'GET' && segments[3] === 'graph') {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    if (hermesSessionKey && request.method === 'POST' && segments[3] === 'resync') {
        const response = await handleHermesProxyRequest(request);
        return response ?? notFound();
    }

    const proxyResponse = await handleHermesProxyRequest(request);

    return proxyResponse ?? notFound();
}
