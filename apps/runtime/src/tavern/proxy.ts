import { type AgentRuntimeCreateMessage, agentRuntimeRoutes } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import { unsupportedHermesSurface } from '../hermes/errors.ts';
import { createLocalHermesClient } from '../hermes/local-client.ts';
import {
    generatedInstructionFileName,
    reconcileRegisteredAgentInstructions,
} from '../workspace/instructions.ts';
import { sendTavernChannelMessage, stopTavernChannelTurn } from './channel-relay.ts';
import { json } from './http.ts';

type LocalHermesClient = ReturnType<typeof createLocalHermesClient>;

interface RouteContext {
    client: LocalHermesClient;
    request: Request;
    url: URL;
}

export async function handleHermesProxyRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const client = createLocalHermesClient();

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
    if (method === 'PATCH' && segments[0] === 'agents' && segments[1] && segments[2] === 'name') {
        return await client.updateAgentName(segments[1], await readJson(request));
    }
    if (
        method === 'PATCH' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'appearance'
    ) {
        return await client.updateAgentAppearance(segments[1], await readJson(request));
    }
    if (method === 'PATCH' && segments[0] === 'agents' && segments[1] && segments[2] === 'model') {
        return await client.updateAgentModel(segments[1], await readJson(request));
    }
    if (
        method === 'PATCH' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'thinking-default'
    ) {
        return await client.updateAgentThinkingDefault(segments[1], await readJson(request));
    }
    if (method === 'PATCH' && segments[0] === 'agents' && segments[1] && segments[2] === 'tools') {
        return await client.updateAgentTools(segments[1], await readJson(request));
    }
    if (method === 'PATCH' && segments[0] === 'agents' && segments[1]) {
        return unsupportedPayload('Hermes agent setting');
    }
    if (method === 'DELETE' && segments[0] === 'agents' && segments[1]) {
        return await client.deleteAgent(segments[1]);
    }
    if (method === 'PUT' && isAgentFileRoute(segments) && segments[3]) {
        const saved = await client.saveAgentFile(segments[1], segments[3], await readJson(request));
        if (segments[3] !== generatedInstructionFileName) {
            return saved;
        }
        // Heal the Tavern-managed block immediately when AGENTS.md is saved,
        // so a tampered block never waits for the next agent sync.
        const healed = await reconcileRegisteredAgentInstructions(getDb(), segments[1]);
        return healed?.written ? await client.getAgentFile(segments[1], segments[3]) : saved;
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.hermesConfig) {
        return await client.getHermesConfig();
    }
    if (method === 'PUT' && url.pathname === agentRuntimeRoutes.hermesConfig) {
        return await client.applyHermesConfig(await readJson(request));
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
    if (url.pathname.startsWith('/toolsets')) {
        return await dispatchToolsets(context, segments);
    }
    if (url.pathname.startsWith('/hermes/chats') || url.pathname.startsWith('/bindings')) {
        return await dispatchChats(context, segments);
    }
    if (url.pathname.startsWith('/cron')) {
        return await dispatchCron(context, segments);
    }
    if (url.pathname.startsWith('/hermes/sessions')) {
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
    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.modelAccessApiKey) {
        return await client.saveModelProviderApiKey(await readJson(request));
    }
    const oauthCancelMatch = url.pathname.match(/^\/model-access\/oauth\/sessions\/([^/]+)$/u);
    if (request.method === 'DELETE' && oauthCancelMatch?.[1]) {
        return await client.cancelModelProviderOAuth({
            sessionId: decodeURIComponent(oauthCancelMatch[1]),
        });
    }
    const oauthStartMatch = url.pathname.match(/^\/model-access\/oauth\/([^/]+)\/start$/u);
    if (request.method === 'POST' && oauthStartMatch?.[1]) {
        return await client.startModelProviderOAuth({
            providerId: decodeURIComponent(oauthStartMatch[1]),
        });
    }
    const oauthPollMatch = url.pathname.match(/^\/model-access\/oauth\/([^/]+)\/poll\/([^/]+)$/u);
    if (request.method === 'GET' && oauthPollMatch?.[1] && oauthPollMatch[2]) {
        return await client.pollModelProviderOAuth({
            providerId: decodeURIComponent(oauthPollMatch[1]),
            sessionId: decodeURIComponent(oauthPollMatch[2]),
        });
    }
    const oauthSubmitMatch = url.pathname.match(/^\/model-access\/oauth\/([^/]+)\/submit$/u);
    if (request.method === 'POST' && oauthSubmitMatch?.[1]) {
        const payload = (await readJson(request)) as { code?: unknown; sessionId?: unknown };
        return await client.submitModelProviderOAuth({
            code: String(payload.code ?? ''),
            providerId: decodeURIComponent(oauthSubmitMatch[1]),
            sessionId: String(payload.sessionId ?? ''),
        });
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
        return await client.listSkills(agentId ? { agentId } : undefined);
    }
    const skillId = segments[1];
    if (!skillId) {
        return undefined;
    }
    if (request.method === 'PUT' && segments[2] === 'enabled') {
        return await client.updateSkillEnabled(skillId, await readJson(request));
    }
    return undefined;
}

async function dispatchToolsets({ client, request, url }: RouteContext, segments: string[]) {
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.toolsets) {
        return await client.listToolsets();
    }
    const toolsetId = segments[1];
    if (!toolsetId) {
        return undefined;
    }
    if (request.method === 'PUT' && segments[2] === 'enabled') {
        return await client.updateToolsetEnabled(toolsetId, await readJson(request));
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
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.discordBindings) {
        return { bindings: [] };
    }
    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.discordBindings) {
        return unsupportedPayload('Hermes does not own Discord bindings.');
    }
    if (
        segments[0] === 'bindings' &&
        segments[1] === 'discord' &&
        segments[2] &&
        (request.method === 'PUT' || request.method === 'DELETE')
    ) {
        return unsupportedPayload('Hermes does not own Discord bindings.');
    }
    if (segments[0] === 'bindings' && segments[1] && request.method === 'DELETE') {
        return await client.deleteBinding(segments[1]);
    }

    const chatId = segments[0] === 'hermes' && segments[1] === 'chats' ? segments[2] : null;
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
    if (
        request.method === 'POST' &&
        segments[3] === 'turns' &&
        segments[4] &&
        segments[5] === 'stop'
    ) {
        return await stopTavernChannelTurn({ runId: segments[4] });
    }
    return undefined;
}

function isTavernChannelMessage(input: AgentRuntimeCreateMessage) {
    if (!input.target) {
        return false;
    }

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
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessionPreviews) {
        const keys = url.searchParams.getAll('key');
        const limit = url.searchParams.get('limit');
        const maxChars = url.searchParams.get('maxChars');
        return await client.listSessionPreviews({
            keys,
            ...(limit ? { limit: Number(limit) } : {}),
            ...(maxChars ? { maxChars: Number(maxChars) } : {}),
        });
    }
    const sessionKey = segments[0] === 'hermes' && segments[1] === 'sessions' ? segments[2] : null;
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
        message: error instanceof Error ? error.message : 'Hermes request failed.',
        retryable: true,
    };
}

function readErrorCode(error: unknown) {
    return typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
        ? error.code
        : 'hermes_request_failed';
}

function unsupportedPayload(message: string) {
    return unsupportedHermesSurface(message);
}
