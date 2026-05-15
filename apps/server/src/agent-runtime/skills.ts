import type { AgentRuntimeInstallSkill } from '@tavern/agent-runtime-protocol';
import { withCapabilityStatus } from './capability-status.ts';
import { AgentRuntimeRequestError, type TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

const agentRuntimeNotConfiguredMessage = 'Tavern Runtime is not configured.';

function requireAgentRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error(agentRuntimeNotConfiguredMessage);
    }

    return client;
}

export async function listAgentRuntimeSkills(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient(),
    runtimeId?: string | null,
    options?: { agentId?: string }
) {
    if (!client) {
        return null;
    }

    const capabilityRuntimeId = runtimeId ?? getCurrentConfiguredAgentRuntimeConnection()?.id;
    const response = capabilityRuntimeId
        ? await withCapabilityStatus(
              {
                  capability: 'skills',
                  method: 'skills.status',
                  runtimeId: capabilityRuntimeId,
              },
              async () => await client.listSkills(options)
          )
        : await client.listSkills(options);
    return response.skills;
}

export async function listAgentRuntimeSkillIds(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient(),
    runtimeId?: string | null
) {
    const skills = await listAgentRuntimeSkills(client, runtimeId);
    return skills?.map((skill) => skill.id) ?? null;
}

export async function getAgentRuntimeSkill(
    skillId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient(),
    runtimeId?: string | null
) {
    if (!client) {
        return null;
    }

    try {
        const capabilityRuntimeId = runtimeId ?? getCurrentConfiguredAgentRuntimeConnection()?.id;

        return capabilityRuntimeId
            ? await withCapabilityStatus(
                  {
                      capability: 'skills',
                      method: 'skills.detail',
                      runtimeId: capabilityRuntimeId,
                  },
                  async () => await client.getSkillConfig(skillId)
              )
            : await client.getSkillConfig(skillId);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return null;
        }

        throw error;
    }
}

export async function installSkillInAgentRuntime(
    input: AgentRuntimeInstallSkill,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return requireAgentRuntimeClient(client).installSkill(input);
}

export async function deleteSkillFromAgentRuntime(
    skillId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    const agentRuntimeClient = requireAgentRuntimeClient(client);

    try {
        await agentRuntimeClient.deleteSkill(skillId);
    } catch (error) {
        if (error instanceof AgentRuntimeRequestError && error.status === 404) {
            return {
                deleted: false,
            } as const;
        }

        throw error;
    }

    return {
        deleted: true,
    } as const;
}
