import type { AgentRuntimeAgent } from '@tavern/api';
import { z } from 'zod';
import {
    deleteAgentRuntimeAgent,
    getAgentRuntimeAgentConfig,
    saveAgentRuntimeAgentConfig,
    toAgentRuntimeCreateAgentConfig,
} from '../agent-runtime/agents.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { skillIdSchema } from '../skills/contracts.ts';
import { findMissingEnabledSkillIds, resolveEnabledSkillIds } from '../skills/enablement.ts';
import { listSkillIds } from '../skills/service.ts';
import * as agentProfileStore from '../storage/agent-profiles.ts';
import {
    getActiveProjectionRuntimeId,
    getAgentRuntimeConnection,
} from '../storage/agent-runtime-connections.ts';
import {
    type AgentProjection,
    deleteAgent as deleteAgentProjection,
    getAgent as getAgentProjection,
    listAgents as listAgentProjections,
    syncAgentsForRuntime,
    updateAgentEnabledSkillIds,
} from '../storage/agents.ts';
import type { AgentDetail, DashboardData } from './contracts.ts';
import {
    buildAgentPalette,
    resolveAgentAvatar,
    resolveAgentDefaultPrimaryColor,
    resolveAgentName,
} from './palette.ts';

export {
    type AgentDiscordBinding,
    buildDiscordBindings,
    buildDiscordUserIdMap,
    querySenderLabelDiscordIds,
} from './discord-bindings.ts';

const agentTargetPattern = /^agent:([^:]+)/;
const hexColorPattern = /^#[0-9a-f]{6}$/i;
const fallbackAgentUpdatedAt = new Date(0).toISOString();

export interface Agent {
    avatar: string | null;
    emoji: string | null;
    enabledSkillIds: string[] | null;
    id: string;
    name: string;
    primaryColor: string | null;
    runtimeId: string;
    updatedAt: string;
}

export const agentDisplayNameSchema = z
    .string()
    .trim()
    .max(80)
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

export const agentPrimaryColorSchema = z
    .string()
    .trim()
    .regex(hexColorPattern, 'Use a 6-digit hex color.')
    .nullable()
    .transform((value) => (value && value.length > 0 ? value.toLowerCase() : null));

export const agentEnabledSkillIdsSchema = z.array(skillIdSchema).nullable();

export interface AgentCatalogItem {
    avatar: string;
    defaultPrimaryColor: string;
    effectivePrimaryColor: string;
    enabledSkillIds: string[];
    id: string;
    name: string;
    primaryColor: string | null;
    runtimeId: string;
    title: string;
    updatedAt: string;
    usesAllSkills: boolean;
}

interface LiveSessionLike {
    agentId: string;
    channel: string;
}

function parseEnabledSkillIds(agent: AgentProjection) {
    const raw = JSON.parse(agent.enabledSkillIdsJson) as unknown;
    const parsed = z.array(skillIdSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
}

function toAgent(
    agent: AgentProjection,
    profile: { primaryColor: string | null; updatedAt: string } | null
): Agent {
    return {
        avatar: agent.avatar ?? null,
        emoji: agent.emoji ?? null,
        enabledSkillIds: parseEnabledSkillIds(agent),
        id: agent.id,
        name: agent.name,
        primaryColor: profile?.primaryColor ?? agent.primaryColor ?? null,
        runtimeId: agent.runtimeId,
        updatedAt: profile?.updatedAt ?? fallbackAgentUpdatedAt,
    };
}

export async function listAgents() {
    const [profiles, agents] = await Promise.all([
        agentProfileStore.listAgentProfiles(),
        listAgentProjections(),
    ]);

    const profilesByAgentKey = new Map(
        profiles.map((profile) => [`${profile.runtimeId}:${profile.agentId}`, profile] as const)
    );

    return agents.map((agent) =>
        toAgent(agent, profilesByAgentKey.get(`${agent.runtimeId}:${agent.id}`) ?? null)
    );
}

export async function getAgent(agentId: string): Promise<null | Agent> {
    const agent = await getAgentProjection(agentId);

    if (!agent) {
        return null;
    }

    const profile = await agentProfileStore.getAgentProfile({
        agentId: agent.id,
        runtimeId: agent.runtimeId,
    });

    return toAgent(agent, profile);
}

export function toAgentCatalogItem(
    agent: Agent,
    availableSkillIds: null | string[] = []
): AgentCatalogItem {
    const enabledSkillIds =
        availableSkillIds === null
            ? [...new Set(agent.enabledSkillIds ?? [])]
            : resolveEnabledSkillIds(agent.enabledSkillIds, availableSkillIds);

    return {
        avatar: resolveAgentAvatar(agent),
        defaultPrimaryColor: resolveAgentDefaultPrimaryColor(agent.id),
        effectivePrimaryColor: buildAgentPalette(agent).accentFrom,
        enabledSkillIds,
        id: agent.id,
        name: resolveAgentName(agent),
        primaryColor: agent.primaryColor,
        runtimeId: agent.runtimeId,
        title: agent.name,
        updatedAt: agent.updatedAt,
        usesAllSkills:
            availableSkillIds !== null &&
            availableSkillIds.length > 0 &&
            enabledSkillIds.length === availableSkillIds.length,
    };
}

export async function listAgentCatalog() {
    const agents = await listAgents();

    return agents
        .map((agent) => toAgentCatalogItem(agent, null))
        .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getPrimaryAgent() {
    const runtimeId = await getActiveProjectionRuntimeId();
    const agents = await listAgents();
    const scopedAgents = runtimeId
        ? agents.filter((agent) => agent.runtimeId === runtimeId)
        : agents;

    return (
        scopedAgents
            .map((agent) => toAgentCatalogItem(agent, null))
            .sort((left, right) => left.name.localeCompare(right.name))[0] ?? null
    );
}

export async function requirePrimaryAgent() {
    const agent = await getPrimaryAgent();

    if (!agent) {
        throw new Error('No synced agent exists. Start Tavern Runtime and sync an agent first.');
    }

    return agent;
}

export function buildDashboardAgents(input: {
    agents: Agent[];
    cronJobs: AgentDetail['cronJobs'];
    sessions: LiveSessionLike[];
}): DashboardData['agents'] {
    return [...input.agents]
        .sort((left, right) => resolveAgentName(left).localeCompare(resolveAgentName(right)))
        .map((agent, index) => {
            const palette = buildAgentPalette(agent);
            const sessions = input.sessions.filter((session) => session.agentId === agent.id);
            const cronCount = input.cronJobs.filter(
                (job) => deriveTargetAgentId(job.target) === agent.id
            ).length;

            return {
                accentFrom: palette.accentFrom,
                accentTo: palette.accentTo,
                avatar: resolveAgentAvatar(agent),
                chatCount: new Set(sessions.map((session) => session.channel)).size,
                cronCount,
                description: 'Runtime-backed agent.',
                id: agent.id,
                kind: 'agent',
                layout: {
                    x: ((index % 3) + 1) * 25,
                    y: Math.floor(index / 3) * 28 + 20,
                },
                memoryCount: 0,
                name: resolveAgentName(agent),
                parentId: null,
                peerIds: [],
                sessionCount: sessions.length,
                title: agent.name,
            } satisfies DashboardData['agents'][number];
        });
}

export function deriveTargetAgentId(target: string) {
    if (target === 'agent-runtime') {
        return null;
    }

    const match = target.match(agentTargetPattern);
    return match?.[1] ?? target;
}

export async function saveCatalogAgentSettings(
    input: {
        agentId: string;
        displayName?: string | null;
        enabledSkillIds?: string[] | null;
    },
    client?: TavernAgentRuntimeClient | null
) {
    const projection = await getAgentProjection(input.agentId);

    if (!projection) {
        throw new Error(`No synced agent named "${input.agentId}" exists.`);
    }

    const runtimeClient = client ?? (await createClientForAgentProjection(projection));
    let availableSkillIdsForResponse: null | string[] = null;
    let nextEnabledSkillIds: string[] | undefined;

    if (input.enabledSkillIds !== undefined) {
        const availableSkillIds = await listSkillIds({
            agentId: input.agentId,
            client: runtimeClient,
            runtimeId: projection.runtimeId,
        });
        availableSkillIdsForResponse = availableSkillIds;
        const missingSkillIds = findMissingEnabledSkillIds(
            input.enabledSkillIds,
            availableSkillIds
        );

        if (missingSkillIds.length > 0) {
            throw new Error(`Unknown skills: ${missingSkillIds.join(', ')}.`);
        }

        nextEnabledSkillIds = resolveEnabledSkillIds(input.enabledSkillIds, availableSkillIds);
    }

    let savedAgentRuntimeAgent: AgentRuntimeAgent | null = null;
    if (input.displayName !== undefined || input.enabledSkillIds !== undefined) {
        const agentRuntimeAgent = await getAgentRuntimeAgentConfig(projection.id, runtimeClient);

        if (!agentRuntimeAgent) {
            throw new Error(`No runtime agent named "${projection.id}" exists.`);
        }

        const { enabledSkillIds: _currentEnabledSkillIds, ...agentRuntimeConfigWithoutSkills } =
            toAgentRuntimeCreateAgentConfig(agentRuntimeAgent);
        savedAgentRuntimeAgent = await saveAgentRuntimeAgentConfig(
            {
                ...agentRuntimeConfigWithoutSkills,
                ...(nextEnabledSkillIds === undefined
                    ? {}
                    : { enabledSkillIds: nextEnabledSkillIds }),
                name: input.displayName ?? agentRuntimeAgent.name,
            },
            runtimeClient
        );
    }

    const profile = await agentProfileStore.getAgentProfile({
        agentId: projection.id,
        runtimeId: projection.runtimeId,
    });

    if (savedAgentRuntimeAgent) {
        await syncAgentsForRuntime({
            agents: (await runtimeClient.listAgents()).agents,
            runtimeId: projection.runtimeId,
        });
    }

    if (input.enabledSkillIds !== undefined) {
        await updateAgentEnabledSkillIds({
            agentId: input.agentId,
            enabledSkillIds: nextEnabledSkillIds ?? [],
        });
    }

    const syncedProjection = await getAgentProjection(input.agentId);
    const agent = syncedProjection
        ? toAgent(syncedProjection, profile)
        : savedAgentRuntimeAgent
          ? toAgentFromAgentRuntimeAgent({
                agent: savedAgentRuntimeAgent,
                id: projection.id,
                profile,
                runtimeId: projection.runtimeId,
            })
          : toAgent(
                {
                    ...projection,
                    enabledSkillIdsJson: JSON.stringify(nextEnabledSkillIds),
                },
                profile
            );

    return toAgentCatalogItem(agent, availableSkillIdsForResponse);
}

export async function saveCatalogAgentProfile(input: {
    agentId: string;
    primaryColor: string | null;
}) {
    const projection = await getAgentProjection(input.agentId);

    if (!projection) {
        throw new Error(`No synced agent named "${input.agentId}" exists.`);
    }

    const profile = await agentProfileStore.saveAgentProfile({
        agentId: projection.id,
        primaryColor: input.primaryColor,
        runtimeId: projection.runtimeId,
    });

    if (!profile) {
        throw new Error(`Failed to save profile for agent "${input.agentId}".`);
    }

    return toAgentCatalogItem(toAgent(projection, profile), null);
}

export async function deleteCatalogAgent(
    agentId: string,
    client?: TavernAgentRuntimeClient | null
) {
    const projection = await getAgentProjection(agentId);

    if (!projection) {
        return;
    }

    await deleteAgentRuntimeAgent(
        projection.id,
        client ?? (await createClientForAgentProjection(projection))
    );
    await agentProfileStore.deleteAgentProfile({
        agentId: projection.id,
        runtimeId: projection.runtimeId,
    });
    await deleteAgentProjection(agentId);
}

async function createClientForAgentProjection(agent: AgentProjection) {
    const connection = await getAgentRuntimeConnection(agent.runtimeId);

    if (!connection?.enabled) {
        throw new Error(`No enabled Tavern Runtime connection named "${agent.runtimeId}" exists.`);
    }

    return createAgentRuntimeClientForConnection(connection);
}

function toAgentFromAgentRuntimeAgent(input: {
    agent: AgentRuntimeAgent;
    id: string;
    profile: { primaryColor: string | null; updatedAt: string } | null;
    runtimeId: string;
}): Agent {
    return {
        avatar: input.agent.avatar ?? null,
        emoji: input.agent.emoji ?? null,
        enabledSkillIds: input.agent.enabledSkillIds,
        id: input.id,
        name: input.agent.name,
        primaryColor: input.profile?.primaryColor ?? input.agent.primaryColor ?? null,
        runtimeId: input.runtimeId,
        updatedAt: input.profile?.updatedAt ?? fallbackAgentUpdatedAt,
    };
}
