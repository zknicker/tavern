import {
    agentRuntimeMacAppListSchema,
    agentRuntimeRoutes,
    runtimeEventListSchema,
    runtimeHealthSchema,
    runtimeRoutes,
} from '@tavern/api';
import { handleCortexRequest } from '../cortex/routes';
import { listMacApps } from '../mac-apps/inventory';
import {
    previewManagedOpenClawSessions,
    refreshManagedOpenClawModelsInBackground,
    refreshManagedOpenClawSkillsInBackground,
} from '../openclaw/agent-sync';
import { handleWorkspaceRequest } from '../workspace/routes';
import { getStoredAgent, listStoredAgents } from './agents-store';
import { handleTavernApiRequest } from './chat-api-router';
import { json, notFound } from './http';
import {
    getStoredOpenClawSessionGraph,
    listStoredOpenClawSessionMessages,
    listStoredOpenClawSessions,
    markStoredOpenClawSessionResynced,
} from './openclaw-sessions-store';
import {
    getStoredOpenClawModels,
    getStoredOpenClawSkill,
    listStoredOpenClawChats,
    listStoredOpenClawSkills,
} from './openclaw-snapshots-store';
import { handleOpenClawProxyRequest } from './proxy';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';
import { getRuntimeStatus } from './status';

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

    const cortexResponse = await handleCortexRequest(request);
    if (cortexResponse) {
        return cortexResponse;
    }

    const workspaceResponse = await handleWorkspaceRequest(request);
    if (workspaceResponse) {
        return workspaceResponse;
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.health) {
        return json(runtimeHealthSchema.parse(getRuntimeStatus().health));
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.status) {
        return json(getRuntimeStatus());
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
        return json(listStoredAgents());
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.chats) {
        return json(listStoredOpenClawChats());
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.models) {
        refreshManagedOpenClawModelsInBackground('models-read');
        return json(getStoredOpenClawModels());
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.skills) {
        refreshManagedOpenClawSkillsInBackground('skills-read');
        return json(listStoredOpenClawSkills());
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessions) {
        return json(listStoredOpenClawSessions());
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessionPreviews) {
        const keys = [
            ...url.searchParams.getAll('key'),
            ...url.searchParams
                .getAll('keys')
                .flatMap((value) => value.split(',').map((key) => key.trim())),
        ];

        return json(
            await previewManagedOpenClawSessions({
                keys,
                limit: readPositiveInteger(url.searchParams.get('limit')),
                maxChars: readPositiveInteger(url.searchParams.get('maxChars')),
            })
        );
    }

    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (
        request.method === 'GET' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const agent = getStoredAgent(segments[1]);
        return agent ? json(agent) : notFound();
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const skill = getStoredOpenClawSkill(segments[1]);
        return skill ? json(skill) : notFound();
    }

    const openClawSessionKey =
        segments[0] === 'openclaw' && segments[1] === 'sessions' ? segments[2] : null;
    if (openClawSessionKey && request.method === 'GET' && segments[3] === 'messages') {
        const limit = url.searchParams.get('limit');
        return json(
            listStoredOpenClawSessionMessages(openClawSessionKey, {
                limit: limit ? Number(limit) : undefined,
            })
        );
    }

    if (openClawSessionKey && request.method === 'GET' && segments[3] === 'graph') {
        const graph = getStoredOpenClawSessionGraph(openClawSessionKey);
        return graph ? json(graph) : notFound();
    }

    if (openClawSessionKey && request.method === 'POST' && segments[3] === 'resync') {
        return json(markStoredOpenClawSessionResynced(openClawSessionKey));
    }

    const proxyResponse = await handleOpenClawProxyRequest(request);

    return proxyResponse ?? notFound();
}

function readPositiveInteger(value: string | null) {
    if (!value) {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}
