import {
    type AgentRuntimeArchiveSkill,
    agentRuntimeArchiveSkillSchema,
} from '@tavern/agent-runtime-protocol';

export function mapOpenClawDeletedSkill(skillId: string): AgentRuntimeArchiveSkill {
    return agentRuntimeArchiveSkillSchema.parse({
        archived: true,
        id: skillId,
    });
}
