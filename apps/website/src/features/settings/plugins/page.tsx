import { browserPluginManifest } from '@tavern/api/plugins/browser';
import { googlePluginManifest } from '@tavern/api/plugins/google';
import { merchbasePluginManifest } from '@tavern/api/plugins/merchbase';
import * as React from 'react';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import {
    useBrowserSettings,
    useOpenBrowser,
    useRestartBrowser,
    useSaveBrowserSettings,
} from '../../../hooks/plugins/use-browser-settings.ts';
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
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { EmptyState } from '../../shell/empty-state.tsx';
import { BrowserSettingsCard } from './browser-settings-card.tsx';
import { GoogleSettingsCard } from './google-settings-card.tsx';
import { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export function PluginsSettingsPage() {
    useRuntimeCapabilityEvents();
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const browserSettingsQuery = useBrowserSettings();
    const saveBrowserSettings = useSaveBrowserSettings();
    const openBrowser = useOpenBrowser();
    const restartBrowser = useRestartBrowser();
    const merchbaseSettingsQuery = useMerchbaseSettings();
    const saveMerchbaseSettings = useSaveMerchbaseSettings();
    const googleSettingsQuery = useGoogleSettings();
    const saveGoogleSettings = useSaveGoogleSettings();
    const googleOAuth = useGoogleOAuthState();
    const showBrowserPlugin = matchesBrowserPlugin(deferredSearch);
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
                    {showBrowserPlugin || showMerchbasePlugin || showGooglePlugin ? (
                        <>
                            {showBrowserPlugin ? (
                                <BrowserSettingsCard
                                    error={
                                        browserSettingsQuery.error?.message ??
                                        saveBrowserSettings.error?.message ??
                                        openBrowser.error?.message ??
                                        restartBrowser.error?.message ??
                                        null
                                    }
                                    isLoading={browserSettingsQuery.isPending}
                                    isSaving={saveBrowserSettings.isPending}
                                    onOpenBrowser={() =>
                                        openBrowser.mutateAsync().catch(() => undefined)
                                    }
                                    onRestartBrowser={() =>
                                        restartBrowser.mutateAsync().catch(() => undefined)
                                    }
                                    onSave={(input) =>
                                        withSavingToast(() =>
                                            saveBrowserSettings.mutateAsync(input)
                                        ).catch(() => undefined)
                                    }
                                    settings={browserSettingsQuery.data ?? null}
                                />
                            ) : null}
                            {showBrowserPlugin && (showMerchbasePlugin || showGooglePlugin) ? (
                                <Separator />
                            ) : null}
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

function matchesBrowserPlugin(search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return ['browser', browserPluginManifest.description, 'chrome', 'web', 'automation'].some(
        (value) => value.toLowerCase().includes(normalized)
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
