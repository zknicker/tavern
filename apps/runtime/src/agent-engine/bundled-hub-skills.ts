import type { AgentRuntimeSkillHubItem } from '@tavern/api';

const tavernWorkflowSkillId = 'tavern-workflow';
const tavernWorkflowIdentifier = `builtin:${tavernWorkflowSkillId}`;
const tavernWorkflowSkillMd = `---
summary: Grotto workflow
---

# Grotto Workflow

Use Grotto workspace context, keep durable knowledge in Memory, and keep execution focused on the active chat goal.
`;

export const builtInHubSkills = [
    {
        description: 'Grotto workspace habits, durable notes, and focused execution guidance.',
        identifier: tavernWorkflowIdentifier,
        name: tavernWorkflowSkillId,
        repo: null,
        skillMd: tavernWorkflowSkillMd,
        source: 'builtin',
        tags: ['tavern', 'workflow'],
        trustLevel: 'builtin',
    },
] satisfies Array<AgentRuntimeSkillHubItem & { skillMd: string }>;

export function bundledHubSkillContent(name: string) {
    return builtInHubSkills.find((skill) => skill.name === name)?.skillMd ?? null;
}
