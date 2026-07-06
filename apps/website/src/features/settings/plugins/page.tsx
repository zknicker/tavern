import { googlePluginManifest } from '@tavern/api/plugins/google';
import { merchbasePluginManifest } from '@tavern/api/plugins/merchbase';
import * as React from 'react';
import { useParams } from 'react-router-dom';
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
    useDisconnectGoogleOAuth,
    useGoogleSettings,
    usePollGoogleOAuth,
    useSaveGoogleSettings,
    useStartGoogleOAuth,
} from '../../../hooks/plugins/use-google-settings.ts';
import {
    useMerchbaseSettings,
    useSaveMerchbaseSettings,
} from '../../../hooks/plugins/use-merchbase-settings.ts';
import { usePluginList, useSetAgentPluginGrant } from '../../../hooks/plugins/use-plugin-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput, PluginListOutput } from '../../../lib/trpc.tsx';
import { EmptyState } from '../../shell/empty-state.tsx';
import { GoogleSettingsCard, GoogleSettingsControl } from './google-settings-card.tsx';
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
    const merchbaseSettingsQuery = useMerchbaseSettings();
    const saveMerchbaseSettings = useSaveMerchbaseSettings();
    const googleSettingsQuery = useGoogleSettings();
    const saveGoogleSettings = useSaveGoogleSettings();
    const googleOAuth = useGoogleOAuthState();
    const showMerchbasePlugin = matchesMerchbasePlugin(deferredSearch);
    const showGooglePlugin = matchesGooglePlugin(deferredSearch);

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
                    {showMerchbasePlugin || showGooglePlugin ? (
                        <>
                            {showMerchbasePlugin ? (
                                <MerchbaseSettingsCard
                                    error={
                                        merchbaseSettingsQuery.error?.message ??
                                        saveMerchbaseSettings.error?.message ??
                                        null
                                    }
                                    isLoading={merchbaseSettingsQuery.isPending}
                                    isSaving={saveMerchbaseSettings.isPending}
                                    onSave={(input) =>
                                        withSavingToast(() =>
                                            saveMerchbaseSettings.mutateAsync(input)
                                        ).catch(() => undefined)
                                    }
                                    settings={merchbaseSettingsQuery.data ?? null}
                                />
                            ) : null}
                            {showMerchbasePlugin && showGooglePlugin ? <Separator /> : null}
                            {showGooglePlugin ? (
                                <GoogleSettingsCard
                                    error={
                                        googleSettingsQuery.error?.message ??
                                        saveGoogleSettings.error?.message ??
                                        googleOAuth.error
                                    }
                                    isLoading={googleSettingsQuery.isPending}
                                    isSaving={saveGoogleSettings.isPending || googleOAuth.isPending}
                                    oauthStatus={googleOAuth.status}
                                    onConnect={googleOAuth.connect}
                                    onDisconnect={googleOAuth.disconnect}
                                    onSave={(input) =>
                                        withSavingToast(() => saveGoogleSettings.mutateAsync(input))
                                    }
                                    settings={googleSettingsQuery.data ?? null}
                                />
                            ) : null}
                        </>
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
    const googleSettingsQuery = useGoogleSettings();
    const saveGoogleSettings = useSaveGoogleSettings();
    const googleOAuth = useGoogleOAuthState();
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
                                        ) : plugin.id === 'google' && googleSettingsQuery.data ? (
                                            <GoogleSettingsControl
                                                error={
                                                    googleSettingsQuery.error?.message ??
                                                    saveGoogleSettings.error?.message ??
                                                    googleOAuth.error
                                                }
                                                isSaving={
                                                    saveGoogleSettings.isPending ||
                                                    googleOAuth.isPending
                                                }
                                                oauthStatus={googleOAuth.status}
                                                onConnect={googleOAuth.connect}
                                                onDisconnect={googleOAuth.disconnect}
                                                onSave={(input) =>
                                                    withSavingToast(() =>
                                                        saveGoogleSettings.mutateAsync(input)
                                                    )
                                                }
                                                settings={googleSettingsQuery.data}
                                            >
                                                {({ openSettingsDialog }) => (
                                                    <Button
                                                        disabled={
                                                            saveGoogleSettings.isPending ||
                                                            googleOAuth.isPending
                                                        }
                                                        onClick={() => openSettingsDialog()}
                                                        variant="ghost"
                                                    >
                                                        Configure
                                                    </Button>
                                                )}
                                            </GoogleSettingsControl>
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
            description={plugin.description}
            title={<span className="truncate">{plugin.displayName}</span>}
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

function useGoogleOAuthState() {
    const [sessionId, setSessionId] = React.useState<string | null>(null);
    const startOAuth = useStartGoogleOAuth();
    const disconnectOAuth = useDisconnectGoogleOAuth();
    const pollOAuth = usePollGoogleOAuth(sessionId);

    React.useEffect(() => {
        if (pollOAuth.data && pollOAuth.data.status !== 'pending') {
            setSessionId(null);
        }
    }, [pollOAuth.data]);

    async function connect() {
        const session = await startOAuth.mutateAsync();
        setSessionId(session.sessionId);
        window.open(session.authUrl, '_blank', 'noopener,noreferrer');
    }

    async function disconnect() {
        await disconnectOAuth.mutateAsync();
    }

    return {
        connect,
        disconnect,
        error:
            startOAuth.error?.message ??
            disconnectOAuth.error?.message ??
            pollOAuth.error?.message ??
            null,
        isPending:
            startOAuth.isPending ||
            disconnectOAuth.isPending ||
            (Boolean(sessionId) && pollOAuth.data?.status === 'pending'),
        status: formatGoogleOAuthStatus(pollOAuth.data?.status ?? null),
    };
}

function formatGoogleOAuthStatus(status: string | null) {
    switch (status) {
        case 'approved':
            return 'Google connected.';
        case 'error':
            return 'Google connection failed.';
        case 'expired':
            return 'Google connection expired.';
        case 'pending':
            return 'Waiting for Google authorization...';
        default:
            return null;
    }
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

function matchesGooglePlugin(search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return [
        'google',
        'calendar',
        googlePluginManifest.description,
        googlePluginManifest.services[0]?.description ?? '',
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
