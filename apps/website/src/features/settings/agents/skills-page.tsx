import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import { usePluginList, useSetAgentPluginGrant } from '../../../hooks/plugins/use-plugin-list.ts';
import { useSkillList } from '../../../hooks/skills/use-skill-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { PluginListOutput } from '../../../lib/trpc.tsx';
import {
    selectAddablePlugins,
    selectAddableSkills,
    selectAgentSkills,
    selectGrantedPlugins,
} from '../../agents/agent-abilities.ts';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { PickerPopover } from '../../agents/picker-popover.tsx';
import { useAgentSkillsUpdate } from '../../agents/use-agent-skills-update.ts';
import { formatSkillName } from '../../skills/skill-name-format.ts';
import { SkillsPageSkeleton } from '../../skills/skills-page-skeleton.tsx';
import { AgentPluginRow, AgentSkillRow } from './ability-rows.tsx';

type Plugin = PluginListOutput['plugins'][number];

export function AgentSkillsSettingsPage() {
    useRuntimeCapabilityEvents();
    const { agentId } = useParams();
    const agentsQuery = useAgentList();
    const skillsQuery = useSkillList();
    const pluginsQuery = usePluginList();
    const saveSkills = useAgentSkillsUpdate();
    const setGrant = useSetAgentPluginGrant();
    const agent = agentsQuery.data?.agents.find((candidate) => candidate.id === agentId) ?? null;
    const skills = skillsQuery.data?.skills ?? [];
    const plugins = pluginsQuery.data?.plugins ?? [];

    if (
        (agentsQuery.isPending || skillsQuery.isPending || pluginsQuery.isPending) &&
        !(agentsQuery.data && skillsQuery.data && pluginsQuery.data)
    ) {
        return <SkillsPageSkeleton />;
    }

    if (!(agent && agentId)) {
        return <MissingAgentState agentId={agentId ?? 'unknown'} />;
    }

    const agentSkills = selectAgentSkills(skills, agent);
    const addableSkills = selectAddableSkills(skills, agent);
    const grantedPlugins = selectGrantedPlugins(plugins, agent);
    const addablePlugins = selectAddablePlugins(plugins, agent);
    const isSavingSkills = saveSkills.isPending && saveSkills.variables?.agentId === agent.id;

    const saveSkillIds = (enabledSkillIds: string[]) =>
        void withSavingToast(() =>
            saveSkills.mutateAsync({ agentId: agent.id, enabledSkillIds })
        ).catch(() => undefined);

    const setPluginGrant = (pluginId: Plugin['id'], enabled: boolean) =>
        void withSavingToast(() =>
            setGrant.mutateAsync({ agentId: agent.id, enabled, pluginId })
        ).catch(() => undefined);

    return (
        <SettingsPage>
            <SettingsPageHeader
                description={`Choose what ${agent.name} can use.`}
                title="Skills & Plugins"
            />

            <SettingsSection
                action={
                    <PickerPopover
                        emptyText="Every usable skill is already added. Install or enable more on the Skills settings page."
                        isPending={isSavingSkills}
                        items={addableSkills.map((skill) => ({
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
                title="Skills"
            >
                {agentSkills.length > 0 ? (
                    <SettingsGroup>
                        {agentSkills.map((skill, index) => (
                            <React.Fragment key={skill.id}>
                                {index > 0 ? <Separator /> : null}
                                <AgentSkillRow
                                    agent={agent}
                                    isSaving={isSavingSkills}
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
                    <EmptySectionText
                        text={`No skills yet. Add skills to give ${agent.name} reusable abilities.`}
                    />
                )}
            </SettingsSection>

            <SettingsSection
                action={
                    <PickerPopover
                        emptyText="Every enabled plugin is already added. Enable more on the Plugins settings page."
                        isPending={setGrant.isPending}
                        items={addablePlugins.map((plugin) => ({
                            id: plugin.id,
                            name: plugin.displayName,
                        }))}
                        label="Add plugins"
                        onAdd={(item) => setPluginGrant(item.id, true)}
                        searchPlaceholder="Search plugins..."
                    />
                }
                title="Plugins"
            >
                {grantedPlugins.length > 0 ? (
                    <SettingsGroup>
                        {grantedPlugins.map((plugin, index) => (
                            <React.Fragment key={plugin.id}>
                                {index > 0 ? <Separator /> : null}
                                <AgentPluginRow
                                    agent={agent}
                                    isSaving={
                                        setGrant.isPending &&
                                        setGrant.variables?.pluginId === plugin.id
                                    }
                                    onRemove={() => setPluginGrant(plugin.id, false)}
                                    plugin={plugin}
                                />
                            </React.Fragment>
                        ))}
                    </SettingsGroup>
                ) : (
                    <EmptySectionText
                        text={
                            addablePlugins.length > 0
                                ? `No plugins yet. Add a plugin to let ${agent.name} use its skills and tools.`
                                : 'No plugins yet. Enable a plugin on the Plugins settings page first.'
                        }
                    />
                )}
            </SettingsSection>
        </SettingsPage>
    );
}

function EmptySectionText({ text }: { text: string }) {
    return (
        <p className="rounded-xl border border-border border-dashed px-4 py-5 text-center text-muted-foreground text-sm">
            {text}
        </p>
    );
}
