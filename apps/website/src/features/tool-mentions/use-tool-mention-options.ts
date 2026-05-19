import * as React from 'react';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';
import type { AgentListOutput, SkillListOutput } from '../../lib/trpc.tsx';

export function useToolMentionOptions({
    query,
}: {
    agentId: string;
    agents: AgentListOutput['agents'];
    query: string;
}) {
    const skillList = useSkillList();

    return React.useMemo(
        () =>
            buildSkillMentionOptions({
                query,
                skills: skillList.data?.skills ?? [],
            }),
        [query, skillList.data?.skills]
    );
}

export function buildSkillMentionOptions({
    query,
    skills,
}: {
    query: string;
    skills: SkillListOutput['skills'];
}) {
    const skillOptions = skills.map((skill) => ({
        description: skill.description,
        id: skill.id,
        kind: 'skill' as const,
        label: skill.name,
        sourceLabel: formatSkillSource(skill),
    }));
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return skillOptions.slice(0, 8);
    }

    return skillOptions
        .filter((option) =>
            `${option.label} ${option.id} ${option.description ?? ''}`
                .toLowerCase()
                .includes(normalizedQuery)
        )
        .slice(0, 8);
}

function formatSkillSource(skill: SkillListOutput['skills'][number]) {
    return skill.dependencyState === 'ready' ? 'Runtime skill' : 'Runtime';
}
