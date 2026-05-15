import type { AgentRuntimeInstallSkill } from '@tavern/agent-runtime-protocol';

export function mapTavernSkillInstallToOpenClaw(input: AgentRuntimeInstallSkill) {
    return {
        slug: input.spec,
        source: 'clawhub',
    };
}
