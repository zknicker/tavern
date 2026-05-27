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
    getActiveRuntimeId,
    getAgentRuntimeConnection,
} from '../storage/agent-runtime-connections.ts';
import {
    type AgentRecord,
    deleteAgent as deleteAgentRecord,
    getAgent as getAgentRecord,
    listAgents as listAgentRecords,
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
    soul: string;
    updatedAt: string;
}

interface ActiveRuntimeAgentRead {
    agent: AgentRuntimeAgent;
    client: TavernAgentRuntimeClient;
    runtimeId: string;
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
export const agentSoulSchema = z.string().max(20_000).nullable();

export interface AgentCatalogItem {
    avatar: string;
    defaultPrimaryColor: string;
    effectivePrimaryColor: string;
    enabledSkillIds: string[];
    id: string;
    name: string;
    primaryColor: string | null;
    runtimeId: string;
    soul: string;
    title: string;
    updatedAt: string;
    usesAllSkills: boolean;
}

interface LiveSessionLike {
    agentId: string;
    channel: string;
}

function parseEnabledSkillIds(agent: AgentRecord) {
    const raw = JSON.parse(agent.enabledSkillIdsJson) as unknown;
    const parsed = z.array(skillIdSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
}

function toAgent(
    agent: AgentRecord,
    profile: { primaryColor: string | null; soul: string; updatedAt: string } | null
): Agent {
    return {
        avatar: agent.avatar ?? null,
        emoji: agent.emoji ?? null,
        enabledSkillIds: parseEnabledSkillIds(agent),
        id: agent.id,
        name: agent.name,
        primaryColor: profile?.primaryColor ?? agent.primaryColor ?? null,
        runtimeId: agent.runtimeId,
        soul: profile?.soul ?? '',
        updatedAt: profile?.updatedAt ?? fallbackAgentUpdatedAt,
    };
}

export async function listAgents() {
    const profiles = await agentProfileStore.listAgentProfiles();
    const activeRuntimeAgents = await listActiveRuntimeAgents();

    const profilesByAgentKey = new Map(
        profiles.map((profile) => [`${profile.runtimeId}:${profile.agentId}`, profile] as const)
    );

    if (activeRuntimeAgents) {
        return activeRuntimeAgents.agents.map((agent) =>
            toAgentFromAgentRuntimeAgent({
                agent,
                id: agent.id,
                profile:
                    profilesByAgentKey.get(`${activeRuntimeAgents.runtimeId}:${agent.id}`) ?? null,
                runtimeId: activeRuntimeAgents.runtimeId,
            })
        );
    }

    const agents = await listAgentRecords();

    return agents.map((agent) =>
        toAgent(agent, profilesByAgentKey.get(`${agent.runtimeId}:${agent.id}`) ?? null)
    );
}

export async function getAgent(agentId: string): Promise<null | Agent> {
    return (await listAgents()).find((agent) => agent.id === agentId) ?? null;
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
        soul: agent.soul,
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
    const runtimeId = await getActiveRuntimeId();
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
        throw new Error('No agent exists. Start Tavern Runtime first.');
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
    const agentRecord = await getAgentRecord(input.agentId);
    const runtimeAgentRead =
        agentRecord === null ? await getActiveRuntimeAgent(input.agentId, client) : null;

    if (!(agentRecord || runtimeAgentRead)) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    const runtimeId = agentRecord?.runtimeId ?? runtimeAgentRead?.runtimeId ?? '';
    const runtimeClient =
        client ??
        (agentRecord ? await createClientForAgentRecord(agentRecord) : runtimeAgentRead?.client);

    if (!runtimeClient) {
        throw new Error(
            `No enabled Tavern Runtime connection exists for agent "${input.agentId}".`
        );
    }

    let availableSkillIdsForResponse: null | string[] = null;
    let nextEnabledSkillIds: string[] | undefined;

    if (input.enabledSkillIds !== undefined) {
        const availableSkillIds = await listSkillIds({
            agentId: input.agentId,
            client: runtimeClient,
            runtimeId,
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
        const agentRuntimeAgent = await getAgentRuntimeAgentConfig(input.agentId, runtimeClient);

        if (!agentRuntimeAgent) {
            throw new Error(`No runtime agent named "${input.agentId}" exists.`);
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
        agentId: input.agentId,
        runtimeId,
    });

    if (agentRecord && savedAgentRuntimeAgent) {
        await syncAgentsForRuntime({
            agents: (await runtimeClient.listAgents()).agents,
            runtimeId: agentRecord.runtimeId,
        });
    }

    if (agentRecord && input.enabledSkillIds !== undefined) {
        await updateAgentEnabledSkillIds({
            agentId: input.agentId,
            enabledSkillIds: nextEnabledSkillIds ?? [],
        });
    }

    const latestAgentRecord = agentRecord ? await getAgentRecord(input.agentId) : null;
    const storedAgent = latestAgentRecord ?? agentRecord;
    const runtimeAgent = savedAgentRuntimeAgent ?? runtimeAgentRead?.agent ?? null;
    const agent = storedAgent
        ? toAgent(
              latestAgentRecord ?? {
                  ...storedAgent,
                  enabledSkillIdsJson: JSON.stringify(
                      nextEnabledSkillIds ?? parseEnabledSkillIds(storedAgent)
                  ),
              },
              profile
          )
        : runtimeAgent
          ? toAgentFromAgentRuntimeAgent({
                agent: runtimeAgent,
                id: input.agentId,
                profile,
                runtimeId,
            })
          : null;

    if (!agent) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    return toAgentCatalogItem(agent, availableSkillIdsForResponse);
}

export async function saveCatalogAgentProfile(input: {
    agentId: string;
    primaryColor?: string | null;
    soul?: string | null;
}) {
    const agentRecord = await getAgentRecord(input.agentId);
    const runtimeAgentRead =
        agentRecord === null ? await getActiveRuntimeAgent(input.agentId) : null;

    if (!(agentRecord || runtimeAgentRead)) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    const runtimeId = agentRecord?.runtimeId ?? runtimeAgentRead?.runtimeId ?? '';
    const profileInput = {
        agentId: input.agentId,
        runtimeId,
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        ...(input.soul !== undefined ? { soul: input.soul } : {}),
    };
    const profile = await agentProfileStore.saveAgentProfile(profileInput);

    if (!profile) {
        throw new Error(`Failed to save profile for agent "${input.agentId}".`);
    }

    if (input.soul !== undefined) {
        const instructionAgent = agentRecord ?? runtimeAgentRead?.agent ?? null;
        await syncAgentWorkspaceInstructions(
            {
                id: input.agentId,
                name: instructionAgent?.name ?? input.agentId,
                runtimeId,
                workspaceFolder: instructionAgent?.workspaceFolder ?? null,
            },
            profile,
            runtimeAgentRead?.client ?? null
        ).catch((error) => {
            console.warn('[tavern] failed to sync agent workspace instructions', error);
        });
    }

    const agent = agentRecord
        ? toAgent(agentRecord, profile)
        : runtimeAgentRead
          ? toAgentFromAgentRuntimeAgent({
                agent: runtimeAgentRead.agent,
                id: input.agentId,
                profile,
                runtimeId,
            })
          : null;

    if (!agent) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    return toAgentCatalogItem(agent, null);
}

export async function deleteCatalogAgent(
    agentId: string,
    client?: TavernAgentRuntimeClient | null
) {
    const agentRecord = await getAgentRecord(agentId);
    const runtimeAgentRead = agentRecord === null ? await getActiveRuntimeAgent(agentId) : null;

    if (!(agentRecord || runtimeAgentRead)) {
        return;
    }

    await deleteAgentRuntimeAgent(
        agentId,
        client ??
            (agentRecord ? await createClientForAgentRecord(agentRecord) : runtimeAgentRead?.client)
    );
    await agentProfileStore.deleteAgentProfile({
        agentId,
        runtimeId: agentRecord?.runtimeId ?? runtimeAgentRead?.runtimeId ?? '',
    });
    if (agentRecord) {
        await deleteAgentRecord(agentId);
    }
}

async function createClientForAgentRecord(agent: AgentRecord) {
    return await createClientForRuntimeId(agent.runtimeId);
}

async function createClientForRuntimeId(runtimeId: string) {
    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!connection?.enabled) {
        throw new Error(`No enabled Tavern Runtime connection named "${runtimeId}" exists.`);
    }

    return createAgentRuntimeClientForConnection(connection);
}

async function listActiveRuntimeAgents() {
    const runtimeId = await getActiveRuntimeId();

    if (!runtimeId) {
        return null;
    }

    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!connection?.enabled) {
        return null;
    }

    const client = createAgentRuntimeClientForConnection(connection);

    try {
        return {
            agents: (await client.listAgents()).agents,
            runtimeId,
        };
    } finally {
        client.close();
    }
}

async function getActiveRuntimeAgent(
    agentId: string,
    client?: TavernAgentRuntimeClient | null
): Promise<ActiveRuntimeAgentRead | null> {
    const runtimeId = await getActiveRuntimeId();

    if (!runtimeId) {
        return null;
    }

    const runtimeClient = client ?? (await createClientForRuntimeId(runtimeId));
    const agent = (await runtimeClient.listAgents()).agents.find(
        (candidate) => candidate.id === agentId
    );

    return agent ? { agent, client: runtimeClient, runtimeId } : null;
}

function toAgentFromAgentRuntimeAgent(input: {
    agent: AgentRuntimeAgent;
    id: string;
    profile: { primaryColor: string | null; soul: string; updatedAt: string } | null;
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
        soul: input.profile?.soul ?? '',
        updatedAt: input.profile?.updatedAt ?? fallbackAgentUpdatedAt,
    };
}

async function syncAgentWorkspaceInstructions(
    agent: {
        id: string;
        name: string;
        runtimeId: string;
        workspaceFolder: string | null;
    },
    profile: agentProfileStore.AgentProfile,
    client?: TavernAgentRuntimeClient | null
) {
    if (!agent.workspaceFolder) {
        throw new Error(`No workspace folder is available for agent "${agent.id}".`);
    }

    const runtimeClient = client ?? (await createClientForRuntimeId(agent.runtimeId));
    await runtimeClient.saveWorkspaceInstructions(agent.id, {
        agentName: agent.name,
        soul: profile.soul,
        workspaceDir: agent.workspaceFolder,
    });
}
