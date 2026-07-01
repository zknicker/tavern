import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import {
    useMerchbaseSettings,
    useSaveMerchbaseSettings,
} from '../../../hooks/plugins/use-merchbase-settings.ts';
import { usePluginList, useSetAgentPluginGrant } from '../../../hooks/plugins/use-plugin-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput, PluginListOutput } from '../../../lib/trpc.tsx';
import { EmptyState } from '../../shell/empty-state.tsx';
import { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export function PluginsSettingsPage() {
    useRuntimeCapabilityEvents();
    const { agentId } = useParams();

    return agentId ? <AgentPluginsSettingsPage agentId={agentId} /> : <GlobalPluginsSettingsPage />;
}

function GlobalPluginsSettingsPage() {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const settingsQuery = useMerchbaseSettings();
    const saveSettings = useSaveMerchbaseSettings();
    const showMerchbasePlugin = matchesMerchbasePlugin(deferredSearch);

    return (
        <SettingsPage>
            <SettingsPageHeader title="Plugins" />

            <div className="grid gap-4">
                <SearchInput
                    aria-label="Search plugins"
                    className="w-full px-3 [&_[data-slot=input-control]]:h-9"
                    name="plugin-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search plugins..."
                    value={search}
                />

                <SettingsSection title="Installed Plugins">
                    <SettingsGroup>
                        {showMerchbasePlugin ? (
                            <MerchbaseSettingsCard
                                error={
                                    settingsQuery.error?.message ??
                                    saveSettings.error?.message ??
                                    null
                                }
                                isLoading={settingsQuery.isPending}
                                isSaving={saveSettings.isPending}
                                onSave={(input) =>
                                    withSavingToast(() => saveSettings.mutateAsync(input)).catch(
                                        () => undefined
                                    )
                                }
                                settings={settingsQuery.data ?? null}
                            />
                        ) : (
                            <EmptyState
                                className="py-8"
                                description="Try a different name or description."
                                title="No matches"
                            />
                        )}
                    </SettingsGroup>
                </SettingsSection>
            </div>
        </SettingsPage>
    );
}

function AgentPluginsSettingsPage({ agentId }: { agentId: string }) {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const agentsQuery = useAgentList();
    const pluginsQuery = usePluginList();
    const setGrant = useSetAgentPluginGrant();
    const agent = agentsQuery.data?.agents.find((candidate) => candidate.id === agentId) ?? null;
    const plugins = pluginsQuery.data?.plugins.filter((plugin) =>
        matchesAgentPlugin(plugin, deferredSearch)
    );

    if ((agentsQuery.isPending || pluginsQuery.isPending) && !(agentsQuery.data && plugins)) {
        return (
            <SettingsPage>
                <SettingsPageHeader title="Plugins" />
                <p className="px-3 text-muted-foreground text-sm">Loading Plugin grants...</p>
            </SettingsPage>
        );
    }

    if (!agent) {
        return (
            <SettingsPage>
                <SettingsPageHeader title="Plugins" />
                <p className="px-3 text-muted-foreground text-sm">Agent not found.</p>
            </SettingsPage>
        );
    }

    return (
        <SettingsPage>
            <SettingsPageHeader title="Plugins" />

            <div className="grid gap-4">
                <SearchInput
                    aria-label="Search plugin grants"
                    className="w-full px-3 [&_[data-slot=input-control]]:h-9"
                    name="agent-plugin-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search plugins..."
                    value={search}
                />

                <SettingsSection title="Agent Plugins">
                    <SettingsGroup>
                        {plugins && plugins.length > 0 ? (
                            plugins.map((plugin, index) => (
                                <React.Fragment key={plugin.id}>
                                    {index > 0 ? <Separator /> : null}
                                    <AgentPluginGrantRow
                                        agent={agent}
                                        isSaving={
                                            setGrant.isPending &&
                                            setGrant.variables?.pluginId === plugin.id
                                        }
                                        onEnabledChange={(enabled) =>
                                            void withSavingToast(() =>
                                                setGrant.mutateAsync({
                                                    agentId: agent.id,
                                                    enabled,
                                                    pluginId: plugin.id,
                                                })
                                            ).catch(() => undefined)
                                        }
                                        plugin={plugin}
                                    />
                                </React.Fragment>
                            ))
                        ) : (
                            <EmptyState
                                className="py-8"
                                description="Try a different name or description."
                                title="No matches"
                            />
                        )}
                    </SettingsGroup>
                </SettingsSection>
            </div>
        </SettingsPage>
    );
}

function AgentPluginGrantRow({
    agent,
    isSaving,
    onEnabledChange,
    plugin,
}: {
    agent: AgentListOutput['agents'][number];
    isSaving: boolean;
    onEnabledChange: (enabled: boolean) => void;
    plugin: PluginListOutput['plugins'][number];
}) {
    const granted = agent.enabledPluginIds.includes(plugin.id);
    return (
        <SettingsRow
            description={
                plugin.enabled
                    ? 'Agent-facing tools and guidance are available when granted.'
                    : 'Grant is saved, but this Plugin must be enabled before the agent can use it.'
            }
            title={
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{plugin.displayName}</span>
                    {plugin.enabled ? null : (
                        <Badge size="sm" variant="warning">
                            Disabled
                        </Badge>
                    )}
                </span>
            }
            trailingWidth="intrinsic"
        >
            <Switch
                aria-label={`${granted ? 'Revoke' : 'Grant'} ${plugin.displayName} for ${agent.name}`}
                checked={granted}
                disabled={isSaving}
                onCheckedChange={onEnabledChange}
            />
        </SettingsRow>
    );
}

function matchesMerchbasePlugin(search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return ['merchbase', 'live sales data', 'rich responses', 'agent reads'].some((value) =>
        value.includes(normalized)
    );
}

function matchesAgentPlugin(plugin: PluginListOutput['plugins'][number], search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return [plugin.id, plugin.displayName].some((value) =>
        value.toLowerCase().includes(normalized)
    );
}
