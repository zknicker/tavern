import * as React from 'react';
import { CodeSnippet } from '../../../components/ui/code-snippet.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import {
    useSaveVaultSettings,
    useVaultSettings,
    useVaultStatus,
} from '../../../hooks/vault/use-vault-status.ts';
import {
    formatVaultAccess,
    formatVaultConfigSource,
    type VaultHubStatus,
    type VaultSettings,
} from '../../memory/memory-status-format.ts';

export function MemoriesSettings() {
    const statusQuery = useVaultStatus();
    const settingsQuery = useVaultSettings();
    const saveSettings = useSaveVaultSettings();

    return (
        <SettingsPage>
            <SettingsPageHeader title="Memory" />
            <SettingsSection description="Memory root and taxonomy status." title="Memory">
                <VaultSettingsCard
                    error={
                        settingsQuery.error?.message ??
                        statusQuery.error?.message ??
                        saveSettings.error?.message ??
                        null
                    }
                    isLoading={settingsQuery.isPending || statusQuery.isPending}
                    isSaving={saveSettings.isPending}
                    onSave={(vaultPath) => saveSettings.mutateAsync({ vaultPath })}
                    settings={settingsQuery.data ?? null}
                    status={statusQuery.data ?? null}
                />
            </SettingsSection>
        </SettingsPage>
    );
}

export function VaultSettingsCard({
    error,
    isLoading,
    isSaving,
    onSave,
    settings,
    status,
}: {
    error?: string | null;
    isLoading?: boolean;
    isSaving?: boolean;
    onSave: (vaultPath: string) => Promise<unknown> | undefined;
    settings: VaultSettings | null;
    status: VaultHubStatus | null;
}) {
    const [vaultPath, setVaultPath] = React.useState('');

    React.useEffect(() => {
        if (settings) {
            setVaultPath(settings.configuredPath ?? settings.effectivePath);
        }
    }, [settings]);

    if (isLoading) {
        return (
            <SettingsGroup>
                <Skeleton className="h-16 rounded-none" />
                <Separator />
                <Skeleton className="h-16 rounded-none" />
                <Separator />
                <Skeleton className="h-16 rounded-none" />
            </SettingsGroup>
        );
    }

    if (!(settings && status)) {
        return (
            <SettingsGroup contentClassName="p-4 text-muted-foreground text-sm">
                {error ?? 'Tavern Runtime unavailable.'}
            </SettingsGroup>
        );
    }

    const trimmedPath = vaultPath.trim();
    const environmentLocked = settings.configSource === 'environment';
    const hasChanged =
        trimmedPath && trimmedPath !== (settings.configuredPath ?? settings.effectivePath);

    return (
        <SettingsGroup>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!(trimmedPath && hasChanged && !environmentLocked)) {
                        return;
                    }
                    void onSave(trimmedPath);
                }}
            >
                <SettingsRow
                    description="Defaults to the managed Runtime memory directory."
                    error={environmentLocked ? 'TAVERN_VAULT_PATH is set by environment.' : null}
                    title="Memory path"
                    trailingWidth="wide"
                >
                    <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Input
                            aria-label="Memory path"
                            className="font-mono md:flex-1"
                            disabled={isSaving || environmentLocked}
                            name="vault-path"
                            onChange={(event) => setVaultPath(event.currentTarget.value)}
                            value={vaultPath}
                        />
                        <Button
                            className="w-fit"
                            disabled={!(trimmedPath && hasChanged) || isSaving || environmentLocked}
                            loading={isSaving}
                            type="submit"
                            variant="secondary"
                        >
                            Save
                        </Button>
                    </div>
                </SettingsRow>
            </form>
            <Separator />
            <SettingsRow title="Effective path" trailingWidth="wide">
                <CodeSnippet lines={settings.effectivePath} />
            </SettingsRow>
            <Separator />
            <SettingsRow title="Config source">
                <SettingsValue>{formatVaultConfigSource(settings.configSource)}</SettingsValue>
            </SettingsRow>
            <Separator />
            <SettingsRow title="Markdown pages">
                <SettingsValue>{status.pageCount}</SettingsValue>
            </SettingsRow>
            <Separator />
            <SettingsRow title="TAXONOMY.md">
                <SettingsValue>{status.indexExists ? 'Present' : 'Missing'}</SettingsValue>
            </SettingsRow>
            <Separator />
            <SettingsRow title="Access">
                <SettingsValue>{formatVaultAccess(status)}</SettingsValue>
            </SettingsRow>
            {error ? (
                <>
                    <Separator />
                    <div className="px-5 py-3.5 text-destructive text-sm">{error}</div>
                </>
            ) : null}
        </SettingsGroup>
    );
}
