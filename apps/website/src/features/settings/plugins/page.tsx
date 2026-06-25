import * as React from 'react';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import {
    useMerchbaseSettings,
    useSaveMerchbaseSettings,
} from '../../../hooks/plugins/use-merchbase-settings.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { EmptyState } from '../../shell/empty-state.tsx';
import { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export function PluginsSettingsPage() {
    useRuntimeCapabilityEvents();
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
                    Connect external services Tavern can use directly
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

function matchesMerchbasePlugin(search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return true;
    }

    return ['merchbase', 'live sales data', 'rich responses', 'agent reads'].some((value) =>
        value.includes(normalized)
    );
}
