import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsGroup, SettingsSection } from '../../../components/ui/settings-row.tsx';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import { useSkillList } from '../../../hooks/skills/use-skill-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { selectAddableSkills, selectAgentSkills } from '../../agents/agent-abilities.ts';
import { PickerPopover } from '../../agents/picker-popover.tsx';
import { useAgentSkillsUpdate } from '../../agents/use-agent-skills-update.ts';
import { formatSkillName } from '../../skills/skill-name-format.ts';
import { AgentSkillRow } from './ability-rows.tsx';

export function AgentSkillsSection({ agent }: { agent: AgentListOutput['agents'][number] }) {
    useRuntimeCapabilityEvents();
    const skillsQuery = useSkillList();
    const saveSkills = useAgentSkillsUpdate();
    const skills = skillsQuery.data?.skills ?? [];
    const assigned = selectAgentSkills(skills, agent);
    const addable = selectAddableSkills(skills, agent);
    const isSaving = saveSkills.isPending && saveSkills.variables?.agentId === agent.id;
    const saveSkillIds = (enabledSkillIds: string[]) =>
        void withSavingToast(() =>
            saveSkills.mutateAsync({ agentId: agent.id, enabledSkillIds })
        ).catch(() => undefined);

    return (
        <SettingsSection
            action={
                <PickerPopover
                    emptyText="Every usable skill is already added."
                    isPending={isSaving}
                    items={addable.map((skill) => ({
                        id: skill.id,
                        name: formatSkillName(skill.name),
                    }))}
                    label="Add skills"
                    onAdd={(item) =>
                        saveSkillIds([...new Set([...agent.enabledSkillIds, item.id])])
                    }
                    searchPlaceholder="Search skills..."
                />
            }
            title={
                <span className="flex items-center gap-2">
                    Skills
                    <Badge size="sm" variant="subtle">
                        {assigned.length}
                    </Badge>
                </span>
            }
        >
            {skillsQuery.isPending ? (
                <SectionMessage>Loading skills...</SectionMessage>
            ) : skillsQuery.isError && !skillsQuery.data ? (
                <SectionMessage>Could not load skills.</SectionMessage>
            ) : assigned.length > 0 ? (
                <SettingsGroup>
                    {assigned.map((skill, index) => (
                        <React.Fragment key={skill.id}>
                            {index > 0 ? <Separator /> : null}
                            <AgentSkillRow
                                agent={agent}
                                isSaving={isSaving}
                                onRemove={() =>
                                    saveSkillIds(
                                        agent.enabledSkillIds.filter((id) => id !== skill.id)
                                    )
                                }
                                skill={skill}
                            />
                        </React.Fragment>
                    ))}
                </SettingsGroup>
            ) : (
                <SectionMessage>No skills yet.</SectionMessage>
            )}
        </SettingsSection>
    );
}

export function SectionMessage({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-xl border border-border border-dashed px-4 py-5 text-center text-muted-foreground text-sm">
            {children}
        </p>
    );
}
