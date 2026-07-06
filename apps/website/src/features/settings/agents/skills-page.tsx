import * as React from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState } from '../../../components/ui/empty-state.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useSkillList } from '../../../hooks/skills/use-skill-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput, SkillListOutput } from '../../../lib/trpc.tsx';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { useAgentSkillsUpdate } from '../../agents/use-agent-skills-update.ts';
import { formatSkillName } from '../../skills/skill-name-format.ts';
import { SkillsPageSkeleton } from '../../skills/skills-page-skeleton.tsx';

type Agent = AgentListOutput['agents'][number];
type SkillSummary = SkillListOutput['skills'][number];

export function AgentSkillsSettingsPage() {
    const { agentId } = useParams();
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const agentsQuery = useAgentList();
    const skillsQuery = useSkillList();
    const saveSkills = useAgentSkillsUpdate();
    const agent = agentsQuery.data?.agents.find((candidate) => candidate.id === agentId) ?? null;

    // Plugin skills are governed by the plugin grant, not per-skill enablement,
    // so they never appear here. Enabling the plugin injects its skills.
    const skills = React.useMemo(
        () =>
            (skillsQuery.data?.skills ?? [])
                .filter((skill) => !skill.plugin)
                .filter((skill) => matchesSkill(skill, deferredSearch)),
        [skillsQuery.data?.skills, deferredSearch]
    );

    if (
        (agentsQuery.isPending || skillsQuery.isPending) &&
        !(agentsQuery.data && skillsQuery.data)
    ) {
        return <SkillsPageSkeleton />;
    }

    if (!(agent && agentId)) {
        return <MissingAgentState agentId={agentId ?? 'unknown'} />;
    }

    return (
        <SettingsPage>
            <SettingsPageHeader title="Skills" />

            <div className="grid gap-3">
                <SearchInput
                    aria-label="Search skills"
                    className="w-full [&_[data-slot=input-control]]:h-9"
                    name="agent-skill-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search skills..."
                    value={search}
                />

                {skills.length > 0 ? (
                    <SettingsGroup>
                        {skills.map((skill, index) => (
                            <React.Fragment key={skill.id}>
                                {index > 0 ? <Separator /> : null}
                                <AgentSkillRow
                                    agent={agent}
                                    isSaving={
                                        saveSkills.isPending &&
                                        saveSkills.variables?.agentId === agent.id
                                    }
                                    onEnabledChange={(enabled) =>
                                        toggleSkill({
                                            agent,
                                            enabled,
                                            saveSkills,
                                            skillId: skill.id,
                                        })
                                    }
                                    skill={skill}
                                />
                            </React.Fragment>
                        ))}
                    </SettingsGroup>
                ) : (
                    <EmptyState
                        className="py-8"
                        description="Add skills from the global Skills page to enable them here."
                        title="No skills"
                    />
                )}
            </div>
        </SettingsPage>
    );
}

function AgentSkillRow({
    agent,
    isSaving,
    onEnabledChange,
    skill,
}: {
    agent: Agent;
    isSaving: boolean;
    onEnabledChange: (enabled: boolean) => void;
    skill: SkillSummary;
}) {
    const enabled = agent.enabledSkillIds.includes(skill.id);
    const displayName = formatSkillName(skill.name);
    return (
        <SettingsRow
            description={skill.description}
            title={<span className="truncate">{displayName}</span>}
            trailingWidth="intrinsic"
        >
            <Switch
                aria-label={`${enabled ? 'Disable' : 'Enable'} ${displayName} for ${agent.name}`}
                checked={enabled}
                disabled={isSaving}
                onCheckedChange={onEnabledChange}
            />
        </SettingsRow>
    );
}

function toggleSkill(input: {
    agent: Agent;
    enabled: boolean;
    saveSkills: ReturnType<typeof useAgentSkillsUpdate>;
    skillId: string;
}) {
    const next = input.enabled
        ? [...input.agent.enabledSkillIds, input.skillId]
        : input.agent.enabledSkillIds.filter((candidate) => candidate !== input.skillId);

    void withSavingToast(() =>
        input.saveSkills.mutateAsync({
            agentId: input.agent.id,
            enabledSkillIds: [...new Set(next)],
        })
    ).catch(() => undefined);
}

function matchesSkill(skill: SkillSummary, search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return [skill.name, skill.description ?? ''].some((value) =>
        value.toLowerCase().includes(normalized)
    );
}
