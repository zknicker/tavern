import { type AgentRuntimeArchiveSkill, agentRuntimeArchiveSkillSchema } from '@tavern/api';

export function mapOpenClawDeletedSkill(skillId: string): AgentRuntimeArchiveSkill {
    return agentRuntimeArchiveSkillSchema.parse({
        archived: true,
        id: skillId,
    });
}
