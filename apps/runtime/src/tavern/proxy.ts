import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeAgent,
    type AgentRuntimeCreateMessage,
    type AgentRuntimeSteerTurn,
    agentRuntimeAgentPluginGrantListSchema,
    agentRuntimeAgentPluginGrantSchema,
    agentRuntimeArchiveAgentSchema,
    agentRuntimeCreateAgentSchema,
    agentRuntimePluginIdSchema,
    agentRuntimeRoutes,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillSchema,
    agentRuntimeUpdateAgentBioSchema,
    agentRuntimeUpdateAgentModelSchema,
    agentRuntimeUpdateAgentNameSchema,
    agentRuntimeUpdateAgentPluginGrantSchema,
    agentRuntimeUpdateAgentTaskSettingsSchema,
    agentRuntimeUpdateAgentThinkingDefaultSchema,
    agentRuntimeUpdateAgentWebSettingsSchema,
    agentRuntimeUpdateSkillEnabledSchema,
    agentRuntimeUpdateToolEnabledSchema,
} from '@tavern/api';
import { defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { unsupportedAgentEngineSurface } from '../agent-engine/errors.ts';
import {
    getRuntimeSkill,
    listRuntimeSkills,
    tasksSkillId,
    tavernAgentSkillId,
} from '../agent-engine/skill-library.ts';
import { AGENT_HOME } from '../config.ts';
import { getDb } from '../db/connection.ts';
import { runRuntimeDoctor } from '../doctor/runtime-doctor.ts';
import { listAgentModels } from '../models/catalog-service.ts';
import {
    resolveAgentModelSelection,
    saveAgentModelSelectionIntent,
} from '../models/selection-service.ts';
import {
    generateRegisteredAgentInstructions,
    registerAgentWorkspace,
} from '../workspace/instructions.ts';
import { agentNotesFileName } from '../workspace/managed-instructions.ts';
import {
    deleteStoredAgent,
    getStoredAgent,
    listAgentPluginGrants,
    listStoredAgents,
    setAgentPluginGrant,
    updateStoredAgent,
    upsertStoredAgent,
} from './agents-store.ts';
import {
    sendTavernChannelMessage,
    steerTavernChannelTurn,
    stopTavernChannelTurn,
} from './channel-relay.ts';
import { json } from './http.ts';
import { primaryManagedAgent } from './managed-agent.ts';
import { getRuntimeTool, listRuntimeTools } from './tool-catalog.ts';

export async function handleAgentProxyRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const payload = await dispatchAgentEngineStatic({ request, url });

    return payload === undefined ? null : json(payload);
}

async function dispatchAgentEngineStatic({ request, url }: { request: Request; url: URL }) {
    const method = request.method;
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (method === 'GET' && url.pathname === agentRuntimeRoutes.agents) {
        ensurePrimaryAgent();
        return withResolvedModelNames(listStoredAgents());
    }
    if (method === 'POST' && url.pathname === agentRuntimeRoutes.agents) {
        const input = agentRuntimeCreateAgentSchema.parse(await readJson(request));
        const agent = upsertStoredAgent({
            agent: {
                autoDispatchEnabled: input.autoDispatchEnabled ?? false,
                webAccessEnabled: input.webAccessEnabled ?? false,
                bio: input.bio ?? null,
                enabledSkillIds: input.enabledSkillIds ?? [tavernAgentSkillId, tasksSkillId],
                enabledPluginIds: input.enabledPluginIds ?? [],
                id: input.id,
                isAdmin: input.isAdmin ?? false,
                name: input.name,
                primaryColor: input.primaryColor ?? null,
                taskReviewPolicy: input.taskReviewPolicy ?? false,
                workspaceFolder: resolveAgentWorkspaceFolder(input),
            },
        });
        await fs.mkdir(agent.workspaceFolder, { recursive: true });
        registerAgentWorkspace(getDb(), {
            agentId: agent.id,
            agentName: agent.name,
            workspaceDir: agent.workspaceFolder,
        });
        await runRuntimeDoctor({
            modules: ['agents'],
            reason: 'agent_changed',
            scope: { kind: 'agent', agentId: agent.id },
        });
        return withResolvedModelName(agent);
    }
    if (method === 'DELETE' && segments[0] === 'agents' && segments[1] && !segments[2]) {
        deleteStoredAgent(segments[1]);
        return agentRuntimeArchiveAgentSchema.parse({
            archived: true,
            id: segments[1],
        });
    }
    if (method === 'GET' && segments[0] === 'agents' && segments[1] && segments[2] === 'config') {
        ensurePrimaryAgent();
        const agent = getStoredAgent(segments[1]);
        return agent ? withResolvedModelName(agent) : undefined;
    }
    if (
        method === 'PATCH' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'task-settings' &&
        !segments[3]
    ) {
        const payload = agentRuntimeUpdateAgentTaskSettingsSchema.parse(await readJson(request));
        const updatedAgent = updateStoredAgent({
            agentId: segments[1],
            autoDispatchEnabled: payload.autoDispatchEnabled,
            taskReviewPolicy: payload.taskReviewPolicy,
        });
        return updatedAgent ? withResolvedModelName(updatedAgent) : undefined;
    }
    if (
        method === 'PATCH' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'web-settings' &&
        !segments[3]
    ) {
        const payload = agentRuntimeUpdateAgentWebSettingsSchema.parse(await readJson(request));
        const updatedAgent = updateStoredAgent({
            agentId: segments[1],
            webAccessEnabled: payload.webAccessEnabled,
        });
        return updatedAgent ? withResolvedModelName(updatedAgent) : undefined;
    }
    if (
        method === 'PATCH' &&
        segments[0] === 'agents' &&
        segments[1] &&
        ['bio', 'model', 'name', 'thinking-default'].includes(segments[2] ?? '')
    ) {
        const input = await readJson(request);
        const agentId = segments[1];
        if (agentId === defaultAgentEngineAgentId) {
            ensurePrimaryAgent();
        }
        let updatedAgent: AgentRuntimeAgent | null = null;
        if (segments[2] === 'model') {
            updatedAgent = await savePatchedModel(agentId, input);
        } else if (segments[2] === 'bio') {
            const payload = agentRuntimeUpdateAgentBioSchema.parse(input);
            updatedAgent = updateStoredAgent({ agentId, bio: payload.bio });
        } else if (segments[2] === 'name') {
            const payload = agentRuntimeUpdateAgentNameSchema.parse(input);
            updatedAgent = updateStoredAgent({ agentId, name: payload.name });
        } else if (segments[2] === 'thinking-default') {
            const payload = agentRuntimeUpdateAgentThinkingDefaultSchema.parse(input);
            updatedAgent = updateStoredAgent({
                agentId,
                thinkingDefault: payload.thinkingDefault,
            });
        }
        if (!updatedAgent) {
            return undefined;
        }
        return agentEngineAgentConfigSnapshot();
    }
    if (method === 'GET' && segments[0] === 'agents' && segments[1] && segments[2] === 'plugins') {
        const agentId = segments[1];
        if (agentId === defaultAgentEngineAgentId) {
            ensurePrimaryAgent();
        }
        const agent = getStoredAgent(agentId);
        if (!agent) {
            return undefined;
        }
        return agentRuntimeAgentPluginGrantListSchema.parse({
            grants: listAgentPluginGrants(agentId).map((grant) => ({
                agentId,
                enabled: grant.enabled === 1,
                pluginId: grant.plugin_id,
                updatedAt: grant.updated_at,
            })),
        });
    }
    if (
        method === 'PUT' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'plugins' &&
        segments[3] &&
        segments[4] === 'enabled'
    ) {
        const payload = agentRuntimeUpdateAgentPluginGrantSchema.parse(await readJson(request));
        const pluginId = agentRuntimePluginIdSchema.parse(segments[3]);
        const agent = setAgentPluginGrant({
            agentId: segments[1],
            enabled: payload.enabled,
            pluginId,
        });
        return agentRuntimeAgentPluginGrantSchema.parse({
            agentId: agent.id,
            enabled: (agent.enabledPluginIds ?? []).includes(pluginId),
            pluginId,
            updatedAt: new Date().toISOString(),
        });
    }
    if (method === 'GET' && segments[0] === 'agents' && segments[1] && segments[2] === 'files') {
        const agentId = segments[1];
        if (segments[3]) {
            return await readAgentEngineAgentFile(agentId, segments[3]);
        }
        return {
            files: await Promise.all(
                agentEngineAgentFiles(agentId).map(readAgentEngineAgentFileSummary)
            ),
        };
    }
    if (method === 'PUT' && segments[0] === 'agents' && segments[1] && segments[2] === 'files') {
        const agentId = segments[1];
        const filePath = segments[3];
        if (!filePath) {
            return undefined;
        }
        const file = resolveAgentEngineAgentFile(agentId, filePath);
        const body = (await readJson(request)) as { content?: unknown };
        await fs.mkdir(path.dirname(file.storagePath), { recursive: true });
        await fs.writeFile(file.storagePath, String(body.content ?? ''), {
            mode: 0o600,
        });
        if (filePath === agentNotesFileName) {
            await generateRegisteredAgentInstructions(getDb(), agentId);
        }
        return await readAgentEngineAgentFile(agentId, filePath);
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.models) {
        return await listAgentModels();
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.skills) {
        const agentId = url.searchParams.get('agentId');
        const agent = agentId
            ? agentId === defaultAgentEngineAgentId
                ? ensurePrimaryAgent()
                : getStoredAgent(agentId)
            : null;
        if (agentId && !agent) {
            return agentRuntimeSkillListSchema.parse({ skills: [] });
        }
        return agentRuntimeSkillListSchema.parse({
            skills: await listRuntimeSkills({ agent }),
        });
    }
    if (method === 'GET' && segments[0] === 'skills' && segments[1] && !segments[2]) {
        const skill = await getRuntimeSkill(segments[1]);
        return skill ? agentRuntimeSkillSchema.parse(skill) : undefined;
    }
    if (method === 'PUT' && segments[0] === 'skills' && segments[1] && segments[2] === 'enabled') {
        agentRuntimeUpdateSkillEnabledSchema.parse(await readJson(request));
        const skill = await getRuntimeSkill(segments[1]);
        return skill ? agentRuntimeSkillSchema.parse(skill) : undefined;
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.tools) {
        return listRuntimeTools();
    }
    if (method === 'PUT' && segments[0] === 'tools' && segments[1] && segments[2] === 'enabled') {
        agentRuntimeUpdateToolEnabledSchema.parse(await readJson(request));
        return getRuntimeTool(segments[1]) ?? undefined;
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.sessions) {
        return { sessions: [] };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.sessionPreviews) {
        return {
            previews: url.searchParams.getAll('key').map((key) => ({
                items: [],
                key,
                status: 'empty',
            })),
        };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.chats) {
        return { chats: [] };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.bindings) {
        return { bindings: [] };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.discordBindings) {
        return { bindings: [] };
    }
    if (method === 'POST' && segments[0] === 'agent' && segments[1] === 'chats') {
        const chatId = segments[2];
        if (chatId && segments[3] === 'messages') {
            const input = (await readJson(request)) as AgentRuntimeCreateMessage;
            if (isTavernChannelMessage(input)) {
                return await sendTavernChannelMessage(chatId, input);
            }
            return unsupportedPayload('Non-Tavern agent chat messages');
        }
        if (chatId && segments[3] === 'turns' && segments[4] && segments[5] === 'steer') {
            const input = (await readJson(request)) as AgentRuntimeSteerTurn;
            return await steerTavernChannelTurn(chatId, {
                ...input,
                runId: segments[4],
            });
        }
        if (chatId && segments[3] === 'turns' && segments[4] && segments[5] === 'stop') {
            return await stopTavernChannelTurn({ runId: segments[4] });
        }
    }
    return undefined;
}

function isTavernChannelMessage(input: AgentRuntimeCreateMessage) {
    if (!input.target) {
        return false;
    }

    return input.target.type === 'tavern';
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}

function unsupportedPayload(message: string) {
    return unsupportedAgentEngineSurface(message);
}

async function savePatchedModel(agentId: string, input: unknown) {
    const payload = agentRuntimeUpdateAgentModelSchema.parse(input);
    const agent = getStoredAgent(agentId);

    if (!agent) {
        return null;
    }
    const inventory = await listAgentModels();
    const executable = inventory.models.some(
        (model) =>
            model.provider === payload.model.provider &&
            model.route.model === payload.model.model &&
            model.availability === 'available'
    );
    if (!executable) {
        throw new Error(
            `Model "${payload.model.provider}/${payload.model.model}" is not executable.`
        );
    }

    saveAgentModelSelectionIntent({
        agentId,
        modelName: payload.model,
    });
    await runRuntimeDoctor({
        modules: ['agents'],
        reason: 'agent_changed',
        scope: { kind: 'agent', agentId },
    });

    return agent;
}

function ensurePrimaryAgent() {
    const existing = getStoredAgent(defaultAgentEngineAgentId);
    if (existing) {
        return existing;
    }

    return upsertStoredAgent({
        agent: { ...primaryManagedAgent(), enabledPluginIds: [] },
    });
}

function resolveAgentWorkspaceFolder(input: { id: string; workspaceFolder?: string }) {
    return input.workspaceFolder ?? path.join(AGENT_HOME, 'agents', input.id, 'workspace');
}

function withResolvedModelNames(input: ReturnType<typeof listStoredAgents>) {
    return {
        agents: input.agents.map(withResolvedModelName),
    };
}

function withResolvedModelName(agent: NonNullable<ReturnType<typeof getStoredAgent>>) {
    const model = resolveAgentModelSelection({ agentId: agent.id });
    return {
        ...agent,
        modelName: {
            model: model.model,
            provider: model.provider,
        },
        thinkingDefault: agent.thinkingDefault ?? null,
    };
}

function agentEngineAgent() {
    return withResolvedModelName(ensurePrimaryAgent());
}

function agentConfigEntry(agent: ReturnType<typeof agentEngineAgent>) {
    return {
        id: agent.id,
        model: agent.modelName,
        name: agent.name,
        thinkingDefault: agent.thinkingDefault,
    };
}

function agentConfigHash(agents: ReturnType<typeof agentEngineAgent>[]) {
    return `agent-engine:${agents
        .map((agent) => `${agent.id}:${agent.modelName.provider}/${agent.modelName.model}`)
        .join(',')}`;
}

function agentEngineAgentConfigSnapshot() {
    ensurePrimaryAgent();
    const agents = listStoredAgents().agents.map(withResolvedModelName);

    return {
        config: {
            agents: {
                list: agents.map(agentConfigEntry),
            },
        },
        hash: agentConfigHash(agents),
        issues: [],
        raw: null,
        valid: true,
    };
}

function agentEngineAgentFiles(agentId: string) {
    const agent =
        agentId === defaultAgentEngineAgentId ? ensurePrimaryAgent() : getStoredAgent(agentId);
    if (!agent) {
        throw unsupportedAgentEngineSurface(`agent "${agentId}"`);
    }
    return [
        {
            mediaType: 'text/markdown',
            path: agentNotesFileName,
            storagePath: path.join(agent.workspaceFolder, agentNotesFileName),
        },
        {
            mediaType: 'text/markdown',
            path: 'SOUL.md',
            storagePath: path.join(agent.workspaceFolder, 'SOUL.md'),
        },
    ];
}

async function readAgentEngineAgentFile(agentId: string, filePath: string) {
    const file = resolveAgentEngineAgentFile(agentId, filePath);
    const stats = await readFileStats(file.storagePath);
    return {
        content: await fs.readFile(file.storagePath, 'utf8').catch(() => ''),
        mediaType: file.mediaType,
        path: file.path,
        sizeBytes: stats?.size ?? 0,
        updatedAt: stats?.updatedAt ?? null,
    };
}

async function readAgentEngineAgentFileSummary(
    file: ReturnType<typeof agentEngineAgentFiles>[number]
) {
    const stats = await readFileStats(file.storagePath);
    return {
        mediaType: file.mediaType,
        path: file.path,
        sizeBytes: stats?.size ?? 0,
        updatedAt: stats?.updatedAt ?? null,
    };
}

function resolveAgentEngineAgentFile(agentId: string, filePath: string) {
    const file = agentEngineAgentFiles(agentId).find((candidate) => candidate.path === filePath);
    if (!file) {
        throw unsupportedAgentEngineSurface(`agent file "${filePath}"`);
    }
    return file;
}

async function readFileStats(filePath: string) {
    const stats = await fs.stat(filePath).catch(() => null);
    return stats
        ? {
              size: stats.size,
              updatedAt: stats.mtime.toISOString(),
          }
        : null;
}
