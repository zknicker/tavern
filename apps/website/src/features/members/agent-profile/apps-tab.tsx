import * as React from 'react';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsGroup, SettingsSection } from '../../../components/ui/settings-row.tsx';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import { usePluginList, useSetAgentPluginGrant } from '../../../hooks/plugins/use-plugin-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput, PluginListOutput } from '../../../lib/trpc.tsx';
import { selectAddablePlugins, selectGrantedPlugins } from '../../agents/agent-abilities.ts';
import { PickerPopover } from '../../agents/picker-popover.tsx';
import { AgentPluginRow } from './ability-rows.tsx';
import { SectionMessage } from './skills-section.tsx';

type Plugin = PluginListOutput['plugins'][number];

export function AgentAppsTab({ agent }: { agent: AgentListOutput['agents'][number] }) {
    useRuntimeCapabilityEvents();
    const pluginsQuery = usePluginList();
    const setGrant = useSetAgentPluginGrant();
    const plugins = pluginsQuery.data?.plugins ?? [];
    const granted = selectGrantedPlugins(plugins, agent);
    const addable = selectAddablePlugins(plugins, agent);
    const setPluginGrant = (pluginId: Plugin['id'], enabled: boolean) =>
        void withSavingToast(() =>
            setGrant.mutateAsync({ agentId: agent.id, enabled, pluginId })
        ).catch(() => undefined);

    return (
        <div className="mx-auto w-full max-w-3xl py-6">
            <SettingsSection
                action={
                    <PickerPopover
                        emptyText="Every enabled app is already added."
                        isPending={setGrant.isPending}
                        items={addable.map((plugin) => ({
                            id: plugin.id,
                            name: plugin.displayName,
                        }))}
                        label="Add apps"
                        onAdd={(item) => setPluginGrant(item.id, true)}
                        searchPlaceholder="Search apps..."
                    />
                }
                title="Apps"
            >
                {pluginsQuery.isPending ? (
                    <SectionMessage>Loading apps...</SectionMessage>
                ) : pluginsQuery.isError ? (
                    <SectionMessage>Could not load apps.</SectionMessage>
                ) : granted.length > 0 ? (
                    <SettingsGroup>
                        {granted.map((plugin, index) => (
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
                    <SectionMessage>No apps yet.</SectionMessage>
                )}
            </SettingsSection>
        </div>
    );
}
