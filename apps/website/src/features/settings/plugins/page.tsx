import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge.tsx';
import { FluidList, FluidListItem } from '../../../components/ui/fluid-list.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
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
        <div className="mx-auto w-full max-w-3xl">
            <header className="pb-6">
                <h1 className="font-semibold text-2xl text-foreground">Plugins</h1>
                <p className="mt-1 text-muted-foreground text-sm">
                    Built-in Tavern integrations with settings, health, agent tools, and rich
                    responses
                </p>
            </header>

            <section className="grid gap-4">
                <SearchInput
                    aria-label="Search plugins"
                    className="w-full [&_[data-slot=input-control]]:h-11 [&_[data-slot=input-control]]:rounded-full"
                    name="plugin-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search plugins..."
                    value={search}
                />

                {showMerchbasePlugin ? (
                    <MerchbaseSettingsCard
                        error={settingsQuery.error?.message ?? saveSettings.error?.message ?? null}
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
                        className="py-16"
                        description="Try a different name or description."
                        title="No matches"
                    />
                )}
            </section>
        </div>
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
        return <p className="text-muted-foreground text-sm">Loading Plugin grants...</p>;
    }

    if (!agent) {
        return <p className="text-muted-foreground text-sm">Agent not found.</p>;
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            <header className="pb-6">
                <h1 className="font-semibold text-2xl text-foreground">Plugins</h1>
                <p className="mt-1 text-muted-foreground text-sm">
                    Choose which built-in integrations {agent.name} can use
                </p>
            </header>

            <section className="grid gap-4">
                <SearchInput
                    aria-label="Search plugin grants"
                    className="w-full [&_[data-slot=input-control]]:h-11 [&_[data-slot=input-control]]:rounded-full"
                    name="agent-plugin-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search plugins..."
                    value={search}
                />

                {plugins && plugins.length > 0 ? (
                    <FluidList className="grid">
                        {plugins.map((plugin, index) => (
                            <FluidListItem className="-mx-3" index={index} key={plugin.id}>
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
                            </FluidListItem>
                        ))}
                    </FluidList>
                ) : (
                    <EmptyState
                        className="py-16"
                        description="Try a different name or description."
                        title="No matches"
                    />
                )}
            </section>
        </div>
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
        <div className="flex select-none items-center gap-4 rounded-xl px-3 py-2.5">
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-[15px] text-foreground">
                        {plugin.displayName}
                    </span>
                    {plugin.enabled ? null : (
                        <Badge size="sm" variant="warning">
                            Disabled
                        </Badge>
                    )}
                </span>
                <span className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                    {plugin.enabled
                        ? 'Agent-facing tools and guidance are available when granted.'
                        : 'Grant is saved, but this Plugin must be enabled before the agent can use it.'}
                </span>
            </span>
            <Switch
                aria-label={`${granted ? 'Revoke' : 'Grant'} ${plugin.displayName} for ${agent.name}`}
                checked={granted}
                disabled={isSaving}
                onCheckedChange={onEnabledChange}
            />
        </div>
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
