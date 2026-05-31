import type { AgentRuntimeCreateMessage } from '@tavern/api';
import { agentRuntimeRoutes } from '@tavern/api';

import { listCodexAppServerSkills, mergeOpenClawAndCodexSkills } from '../codex-app-server/skills';
import { createLocalOpenClawClient } from '../openclaw/local-client';
import { sendTavernChannelMessage } from './channel-relay';
import { json } from './http';

type LocalOpenClawClient = ReturnType<typeof createLocalOpenClawClient>;

interface RouteContext {
    client: LocalOpenClawClient;
    request: Request;
    url: URL;
}

export async function handleOpenClawProxyRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const client = createLocalOpenClawClient();

    try {
        const payload = await dispatch({ client, request, url });
        return payload === undefined ? null : json(payload);
    } catch (error) {
        return json(toRuntimeError(error), 502);
    } finally {
        client.close();
    }
}

async function dispatch(context: RouteContext) {
    const { client, request, url } = context;
    const method = request.method;
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (method === 'GET' && url.pathname === agentRuntimeRoutes.agents) {
        return await client.listAgents();
    }
    if (method === 'POST' && url.pathname === agentRuntimeRoutes.agents) {
        return await client.upsertAgent(await readJson(request));
    }
    if (method === 'GET' && segments[0] === 'agents') {
        return await dispatchAgentGet(context, segments);
    }
    if (method === 'DELETE' && segments[0] === 'agents' && segments[1]) {
        return await client.deleteAgent(segments[1]);
    }
    if (method === 'PUT' && isAgentFileRoute(segments) && segments[3]) {
        return await client.saveAgentFile(segments[1], segments[3], await readJson(request));
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.openClawConfig) {
        return await client.getOpenClawConfig();
    }
    if (method === 'PUT' && url.pathname === agentRuntimeRoutes.openClawConfig) {
        return await client.applyOpenClawConfig(await readJson(request));
    }
    if (url.pathname.startsWith('/model-access')) {
        return await dispatchModelAccess(context);
    }
    if (url.pathname.startsWith('/models')) {
        return await dispatchModels(context);
    }
    if (url.pathname.startsWith('/skills')) {
        return await dispatchSkills(context, segments);
    }
    if (url.pathname.startsWith('/openclaw/chats') || url.pathname.startsWith('/bindings')) {
        return await dispatchChats(context, segments);
    }
    if (url.pathname.startsWith('/cron')) {
        return await dispatchCron(context, segments);
    }
    if (url.pathname.startsWith('/openclaw/sessions')) {
        return await dispatchSessions(context, segments);
    }
    return undefined;
}

async function dispatchAgentGet(context: RouteContext, segments: string[]) {
    const { client } = context;
    const agentId = segments[1];
    if (!agentId) {
        return undefined;
    }
    if (segments[2] === 'config') {
        return await client.getAgentConfig(agentId);
    }
    if (segments[2] === 'files' && !segments[3]) {
        return await client.listAgentFiles(agentId);
    }
    if (segments[2] === 'files' && segments[3]) {
        return await client.getAgentFile(agentId, segments[3]);
    }
    return undefined;
}

async function dispatchModelAccess({ client, request, url }: RouteContext) {
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.modelAccess) {
        return await client.getModelAccess();
    }
    if (url.pathname === agentRuntimeRoutes.modelAccessOpenRouterSettings) {
        if (request.method === 'GET') {
            return await client.getOpenRouterSettings();
        }
        if (request.method === 'PUT') {
            return await client.saveOpenRouterSettings(await readJson(request));
        }
        if (request.method === 'DELETE') {
            return await client.deleteOpenRouterSettings();
        }
    }
    return undefined;
}

async function dispatchModels({ client, request, url }: RouteContext) {
    if (url.pathname !== agentRuntimeRoutes.models) {
        return undefined;
    }
    if (request.method === 'GET') {
        return await client.getModels();
    }
    return undefined;
}

async function dispatchSkills({ client, request, url }: RouteContext, segments: string[]) {
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.skills) {
        const agentId = url.searchParams.get('agentId');
        const [openClawSkills, codexSkills] = await Promise.all([
            client.listSkills(agentId ? { agentId } : undefined),
            listCodexAppServerSkills().catch(() => []),
        ]);
        return {
            skills: mergeOpenClawAndCodexSkills(openClawSkills.skills, codexSkills),
        };
    }
    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.skillInstall) {
        return await client.installSkill(await readJson(request));
    }
    const skillId = segments[1];
    if (!skillId) {
        return undefined;
    }
    if (request.method === 'GET' && segments[2] === 'config') {
        return await client.getSkillConfig(skillId);
    }
    if (request.method === 'DELETE' && segments.length === 2) {
        return await client.deleteSkill(skillId);
    }
    return undefined;
}

async function dispatchChats({ client, request, url }: RouteContext, segments: string[]) {
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.chats) {
        return await client.listChats();
    }
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.bindings) {
        return await client.listBindings();
    }
    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.bindings) {
        return await client.upsertBinding(await readJson(request));
    }
    if (segments[0] === 'bindings' && segments[1] && request.method === 'DELETE') {
        return await client.deleteBinding(segments[1]);
    }
    const chatId = segments[0] === 'openclaw' && segments[1] === 'chats' ? segments[2] : null;
    if (!chatId) {
        return undefined;
    }
    if (request.method === 'POST' && segments[3] === 'messages') {
        const input = (await readJson(request)) as AgentRuntimeCreateMessage;
        if (isTavernChannelMessage(input)) {
            return await sendTavernChannelMessage(chatId, input);
        }
        return await client.postMessage(chatId, input);
    }
    return undefined;
}

function isTavernChannelMessage(input: AgentRuntimeCreateMessage) {
    return (
        input.target.type === 'tavern' ||
        input.target.sessionKey?.includes(':tavern:channel:') === true
    );
}

async function dispatchCron({ client, request, url }: RouteContext, segments: string[]) {
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cronJobs) {
        return await client.listCronJobs();
    }
    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cronJobs) {
        return await client.createCronJob(await readJson(request));
    }
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cronRuns) {
        return await client.listCronRuns();
    }
    const cronJobId = segments[0] === 'cron-jobs' ? segments[1] : null;
    if (cronJobId) {
        if (request.method === 'GET' && segments.length === 2) {
            return await client.getCronJob(cronJobId);
        }
        if (request.method === 'PATCH' && segments.length === 2) {
            return await client.updateCronJob(cronJobId, await readJson(request));
        }
        if (request.method === 'DELETE' && segments.length === 2) {
            return await client.deleteCronJob(cronJobId);
        }
        if (request.method === 'POST' && segments[2] === 'run') {
            return await client.runCronJob(cronJobId, await readJson(request));
        }
        if (request.method === 'GET' && segments[2] === 'runs') {
            return await client.listCronRuns(cronJobId);
        }
    }
    return undefined;
}

async function dispatchSessions({ client, request, url }: RouteContext, segments: string[]) {
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessions) {
        return await client.listSessions();
    }
    const sessionKey =
        segments[0] === 'openclaw' && segments[1] === 'sessions' ? segments[2] : null;
    if (!sessionKey) {
        return undefined;
    }
    if (request.method === 'GET' && segments[3] === 'messages') {
        const limit = url.searchParams.get('limit');
        return await client.listSessionMessages(
            sessionKey,
            limit ? { limit: Number(limit) } : undefined
        );
    }
    if (request.method === 'GET' && segments[3] === 'graph') {
        return await client.getSessionGraph(sessionKey);
    }
    if (request.method === 'GET' && segments[3] === 'prompt') {
        const prompt = await client.getSessionPrompt(sessionKey);
        return prompt ?? undefined;
    }
    if (request.method === 'POST' && segments[3] === 'resync') {
        return await client.resyncSession(sessionKey);
    }
    return undefined;
}

async function readJson(request: Request): Promise<never> {
    return (await request.json().catch(() => ({}))) as never;
}

function isAgentFileRoute(segments: string[]) {
    return segments[0] === 'agents' && segments[1] && segments[2] === 'files';
}

function toRuntimeError(error: unknown) {
    return {
        code: readErrorCode(error),
        message: error instanceof Error ? error.message : 'OpenClaw request failed.',
        retryable: true,
    };
}

function readErrorCode(error: unknown) {
    return typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
        ? error.code
        : 'openclaw_request_failed';
}
