import { merchbasePluginManifest } from '@tavern/api/plugins/merchbase';
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
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
import { MerchbaseSettingsCard, MerchbaseSettingsControl } from './merchbase-settings-card.tsx';

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

            <SettingsSection title="Installed Plugins">
                <SearchInput
                    aria-label="Search plugins"
                    className="w-full [&_[data-slot=input-control]]:h-9"
                    name="plugin-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search plugins..."
                    value={search}
                />

                <SettingsGroup>
                    {showMerchbasePlugin ? (
                        <MerchbaseSettingsCard
                            error={
                                settingsQuery.error?.message ?? saveSettings.error?.message ?? null
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
        </SettingsPage>
    );
}

function AgentPluginsSettingsPage({ agentId }: { agentId: string }) {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const agentsQuery = useAgentList();
    const merchbaseSettingsQuery = useMerchbaseSettings();
    const saveMerchbaseSettings = useSaveMerchbaseSettings();
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

            <div className="grid gap-3">
                <SearchInput
                    aria-label="Search plugin grants"
                    className="w-full [&_[data-slot=input-control]]:h-9"
                    name="agent-plugin-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search plugins..."
                    value={search}
                />

                <SettingsGroup>
                    {plugins && plugins.length > 0 ? (
                        plugins.map((plugin, index) => {
                            const row = (
                                <AgentPluginGrantRow
                                    agent={agent}
                                    configureAction={
                                        plugin.id === 'merchbase' && merchbaseSettingsQuery.data ? (
                                            <MerchbaseSettingsControl
                                                error={
                                                    merchbaseSettingsQuery.error?.message ??
                                                    saveMerchbaseSettings.error?.message ??
                                                    null
                                                }
                                                isSaving={saveMerchbaseSettings.isPending}
                                                onSave={(input) =>
                                                    withSavingToast(() =>
                                                        saveMerchbaseSettings.mutateAsync(input)
                                                    ).catch(() => undefined)
                                                }
                                                settings={merchbaseSettingsQuery.data}
                                            >
                                                {({ openSettingsDialog }) => (
                                                    <Button
                                                        disabled={saveMerchbaseSettings.isPending}
                                                        onClick={() => openSettingsDialog()}
                                                        variant="ghost"
                                                    >
                                                        Configure
                                                    </Button>
                                                )}
                                            </MerchbaseSettingsControl>
                                        ) : null
                                    }
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
                            );

                            return (
                                <React.Fragment key={plugin.id}>
                                    {index > 0 ? <Separator /> : null}
                                    {row}
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <EmptyState
                            className="py-8"
                            description="Try a different name or description."
                            title="No matches"
                        />
                    )}
                </SettingsGroup>
            </div>
        </SettingsPage>
    );
}

export function AgentPluginGrantRow({
    agent,
    configureAction = null,
    isSaving,
    onEnabledChange,
    plugin,
}: {
    agent: AgentListOutput['agents'][number];
    configureAction?: React.ReactNode;
    isSaving: boolean;
    onEnabledChange: (enabled: boolean) => void;
    plugin: PluginListOutput['plugins'][number];
}) {
    const granted = agent.enabledPluginIds.includes(plugin.id);
    return (
        <SettingsRow
            description={
                plugin.enabled
                    ? plugin.description
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
            <div className="flex items-center gap-2">
                {configureAction}
                <Switch
                    aria-label={`${granted ? 'Revoke' : 'Grant'} ${plugin.displayName} for ${agent.name}`}
                    checked={granted}
                    disabled={isSaving}
                    onCheckedChange={onEnabledChange}
                />
            </div>
        </SettingsRow>
    );
}

function matchesMerchbasePlugin(search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return [
        'merchbase',
        merchbasePluginManifest.description,
        'sales',
        'product',
        'catalog',
        'design',
    ].some((value) => value.toLowerCase().includes(normalized));
}

function matchesAgentPlugin(plugin: PluginListOutput['plugins'][number], search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return [plugin.id, plugin.displayName, plugin.description].some((value) =>
        value.toLowerCase().includes(normalized)
    );
}
