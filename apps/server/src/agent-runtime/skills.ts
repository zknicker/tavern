import { withCapabilityStatus } from './capability-status.ts';
import { AgentRuntimeRequestError, type TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

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
