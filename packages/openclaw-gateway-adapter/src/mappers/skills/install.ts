import type { AgentRuntimeInstallSkill } from '@tavern/api';

export function mapTavernSkillInstallToOpenClaw(input: AgentRuntimeInstallSkill) {
    return {
        slug: input.spec,
        source: 'clawhub',
    };
}
