import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { AgentRuntimeSaveGoogleSettings } from '@tavern/api';
import { googlePluginManifest } from '@tavern/api/plugins/google';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import type { GoogleSettingsOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { GoogleSettingsDialog } from './google-settings-dialog.tsx';
import {
    createGoogleDraft,
    type GoogleSettingsDraft,
    hasGoogleDraftChanges,
    normalizeGoogleDraft,
    toGoogleSaveInput,
} from './google-settings-model.ts';

type GoogleSettings = NonNullable<GoogleSettingsOutput>;

export function GoogleSettingsCard({
    error,
    isLoading = false,
    isSaving = false,
    oauthStatus = null,
    onConnect,
    onDisconnect,
    onSave,
    settings,
}: {
    error?: string | null;
    isLoading?: boolean;
    isSaving?: boolean;
    oauthStatus?: string | null;
    onConnect: () => Promise<unknown> | undefined;
    onDisconnect: () => Promise<unknown> | undefined;
    onSave: (input: AgentRuntimeSaveGoogleSettings) => Promise<unknown> | undefined;
    settings: GoogleSettings | null;
}) {
    if (isLoading) {
        return <GooglePluginSkeleton />;
    }

    if (!settings) {
        return (
            <SettingsRow
                description={error ?? 'Tavern Runtime unavailable.'}
                title="Google"
                trailingWidth="intrinsic"
            >
                <Button disabled variant="ghost">
                    Configure
                </Button>
            </SettingsRow>
        );
    }

    const currentSettings = settings;

    return (
        <GoogleSettingsControl
            error={error}
            isSaving={isSaving}
            oauthStatus={oauthStatus}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onSave={onSave}
            settings={currentSettings}
        >
            {({ openSettingsDialog, requestSave }) => {
                function handleEnabledChange(enabled: boolean) {
                    if (enabled && !currentSettings.connected) {
                        openSettingsDialog();
                        return;
                    }
                    void requestSave({ enabled }).catch(() => undefined);
                }

                return (
                    <GooglePluginRow
                        isSaving={isSaving}
                        onEnabledChange={handleEnabledChange}
                        onSelect={openSettingsDialog}
                        settings={currentSettings}
                    />
                );
            }}
        </GoogleSettingsControl>
    );
}

export function GoogleSettingsControl({
    children,
    error,
    isSaving,
    oauthStatus,
    onConnect,
    onDisconnect,
    onSave,
    settings,
}: {
    children: (control: {
        openSettingsDialog: (nextDraft?: Partial<GoogleSettingsDraft>) => void;
        requestSave: (input: AgentRuntimeSaveGoogleSettings) => Promise<unknown>;
    }) => React.ReactNode;
    error?: string | null;
    isSaving: boolean;
    oauthStatus?: string | null;
    onConnect: () => Promise<unknown> | undefined;
    onDisconnect: () => Promise<unknown> | undefined;
    onSave: (input: AgentRuntimeSaveGoogleSettings) => Promise<unknown> | undefined;
    settings: GoogleSettings;
}) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [draft, setDraft] = React.useState<GoogleSettingsDraft>(() =>
        createGoogleDraft(settings)
    );
    const normalized = normalizeGoogleDraft(draft);
    const hasChanges = hasGoogleDraftChanges(settings, normalized);
    const canSave = hasChanges;

    React.useEffect(() => {
        setDraft(createGoogleDraft(settings));
    }, [settings]);

    function openSettingsDialog(nextDraft?: Partial<GoogleSettingsDraft>) {
        setDraft({ ...createGoogleDraft(settings), ...nextDraft });
        setDialogOpen(true);
    }

    async function requestSave(input: AgentRuntimeSaveGoogleSettings) {
        return await onSave(input);
    }

    async function handleConnect() {
        if (hasChanges) {
            await onSave(toGoogleSaveInput(settings, normalized));
        }
        await onConnect();
    }

    return (
        <>
            {children({ openSettingsDialog, requestSave })}

            <GoogleSettingsDialog
                canSave={canSave}
                draft={draft}
                error={error}
                isSaving={isSaving}
                oauthStatus={oauthStatus}
                onConnect={handleConnect}
                onDisconnect={onDisconnect}
                onDraftChange={setDraft}
                onOpenChange={setDialogOpen}
                onSave={() => requestSave(toGoogleSaveInput(settings, normalized))}
                open={dialogOpen}
                settings={settings}
            />
        </>
    );
}

function GooglePluginRow({
    isSaving,
    onEnabledChange,
    onSelect,
    settings,
}: {
    isSaving: boolean;
    onEnabledChange: (enabled: boolean) => void;
    onSelect: () => void;
    settings: GoogleSettings;
}) {
    return (
        <SettingsRow
            description={googlePluginManifest.description}
            title={
                <span
                    className={cn(
                        'flex min-w-0 items-center gap-2',
                        !settings.enabled && 'opacity-45'
                    )}
                >
                    <Icon className="size-5" icon={PlugIcon} />
                    <span className="truncate">Google</span>
                    {settings.connected ? null : (
                        <Badge size="sm" variant="error">
                            Needs setup
                        </Badge>
                    )}
                </span>
            }
            trailingWidth="intrinsic"
        >
            <div className="flex items-center gap-2">
                <Button disabled={isSaving} onClick={onSelect} variant="ghost">
                    {settings.connected ? 'Configure' : 'Set up'}
                </Button>
                <Switch
                    aria-label={`${settings.enabled ? 'Disable' : 'Enable'} Google`}
                    checked={settings.enabled}
                    disabled={isSaving}
                    onCheckedChange={onEnabledChange}
                />
            </div>
        </SettingsRow>
    );
}

function GooglePluginSkeleton() {
    return (
        <SettingsRow description={googlePluginManifest.description} title="Google">
            <Skeleton className="h-9 w-24" />
        </SettingsRow>
    );
}
