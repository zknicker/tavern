import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { CodeSnippet } from '../../../components/ui/code-snippet.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../../components/ui/settings-row.tsx';
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
} from '../../memory/wiki-status-format.ts';

export function MemoriesSettings() {
    const statusQuery = useVaultStatus();
    const settingsQuery = useVaultSettings();
    const saveSettings = useSaveVaultSettings();

    return (
        <div>
            <BadgeDivider className="pb-4" subtext="Vault root and Markdown index status.">
                Vault
            </BadgeDivider>
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
        </div>
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
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <Skeleton className="h-16 rounded-none" />
                    <Separator />
                    <Skeleton className="h-16 rounded-none" />
                    <Separator />
                    <Skeleton className="h-16 rounded-none" />
                </Card>
            </CardFrame>
        );
    }

    if (!(settings && status)) {
        return (
            <CardFrame>
                <Card className="p-4 text-muted-foreground text-sm">
                    {error ?? 'Tavern Runtime unavailable.'}
                </Card>
            </CardFrame>
        );
    }

    const trimmedPath = vaultPath.trim();
    const environmentLocked = settings.configSource === 'environment';
    const hasChanged =
        trimmedPath && trimmedPath !== (settings.configuredPath ?? settings.effectivePath);

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
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
                        description="Defaults to ~/wiki."
                        error={
                            environmentLocked ? 'TAVERN_VAULT_PATH is set by environment.' : null
                        }
                        title="Vault path"
                    >
                        <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                            <Input
                                aria-label="Vault path"
                                className="font-mono md:flex-1"
                                disabled={isSaving || environmentLocked}
                                name="vault-path"
                                onChange={(event) => setVaultPath(event.currentTarget.value)}
                                value={vaultPath}
                            />
                            <Button
                                className="w-fit"
                                disabled={
                                    !(trimmedPath && hasChanged) || isSaving || environmentLocked
                                }
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
                <SettingsRow title="Effective path">
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
                <SettingsRow title="INDEX.md">
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
            </Card>
        </CardFrame>
    );
}
