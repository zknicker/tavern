import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { AgentRuntimeSaveBrowserSettings } from '@tavern/api';
import { browserPluginManifest } from '@tavern/api/plugins/browser';
import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import type { BrowserSettingsOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { BrowserSettingsDialog } from './browser-settings-dialog.tsx';
import {
    type BrowserSettingsDraft,
    createDraft,
    hasDraftChanges,
    normalizeDraft,
    toSaveInput,
} from './browser-settings-model.ts';
import { PluginEnablementSwitch } from './plugin-enablement-switch.tsx';

type BrowserSettings = NonNullable<BrowserSettingsOutput>;
type BrowserSettingsControlRender = (control: {
    openSettingsDialog: (nextDraft?: Partial<BrowserSettingsDraft>) => void;
    requestSave: (input: AgentRuntimeSaveBrowserSettings) => void;
}) => React.ReactNode;

export function BrowserSettingsCard({
    error,
    isLoading = false,
    isSaving = false,
    onOpenBrowser,
    onRestartBrowser,
    onSave,
    settings,
}: {
    error?: string | null;
    isLoading?: boolean;
    isSaving?: boolean;
    onOpenBrowser: () => Promise<unknown> | undefined;
    onRestartBrowser: () => Promise<unknown> | undefined;
    onSave: (input: AgentRuntimeSaveBrowserSettings) => Promise<unknown> | undefined;
    settings: BrowserSettings | null;
}) {
    if (isLoading) {
        return <BrowserPluginSkeleton />;
    }

    if (!settings) {
        return (
            <SettingsRow
                description={error ?? 'Tavern Runtime unavailable.'}
                title="Browser"
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
        <BrowserSettingsControl
            error={error}
            isSaving={isSaving}
            onOpenBrowser={onOpenBrowser}
            onRestartBrowser={onRestartBrowser}
            onSave={onSave}
            settings={currentSettings}
        >
            {({ openSettingsDialog, requestSave }) => (
                <BrowserPluginRow
                    isSaving={isSaving}
                    onEnabledChange={(enabled) => requestSave({ enabled })}
                    onSelect={openSettingsDialog}
                    settings={currentSettings}
                />
            )}
        </BrowserSettingsControl>
    );
}

export function BrowserSettingsControl({
    children,
    error,
    isSaving,
    onOpenBrowser,
    onRestartBrowser,
    onSave,
    settings,
}: {
    children: BrowserSettingsControlRender;
    error?: string | null;
    isSaving: boolean;
    onOpenBrowser: () => Promise<unknown> | undefined;
    onRestartBrowser: () => Promise<unknown> | undefined;
    onSave: (input: AgentRuntimeSaveBrowserSettings) => Promise<unknown> | undefined;
    settings: BrowserSettings;
}) {
    const [draft, setDraft] = React.useState<BrowserSettingsDraft>(() => createDraft(settings));
    const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
    const [replaceDialogOpen, setReplaceDialogOpen] = React.useState(false);
    const [pendingSave, setPendingSave] = React.useState<AgentRuntimeSaveBrowserSettings | null>(
        null
    );

    React.useEffect(() => {
        setDraft(createDraft(settings));
        setPendingSave(null);
        setReplaceDialogOpen(false);
    }, [settings]);

    const currentSettings = settings;
    const normalized = normalizeDraft(draft);
    const hasChanges = hasDraftChanges(currentSettings, normalized);
    const needsReplaceConfirmation = Boolean(currentSettings.skillConflict && normalized.enabled);
    const missingProfileName = normalized.profileName.length === 0;
    const canSave = !missingProfileName && (hasChanges || needsReplaceConfirmation);
    const setupError = missingProfileName ? 'Set a profile name before saving.' : null;

    function openSettingsDialog(nextDraft?: Partial<BrowserSettingsDraft>) {
        setDraft({ ...createDraft(currentSettings), ...nextDraft });
        setPendingSave(null);
        setReplaceDialogOpen(false);
        setSettingsDialogOpen(true);
    }

    function requestSave(input: AgentRuntimeSaveBrowserSettings) {
        if (currentSettings.skillConflict && input.enabled === true) {
            setPendingSave(input);
            setReplaceDialogOpen(true);
            return;
        }
        void onSave(input);
    }

    return (
        <>
            {children({ openSettingsDialog, requestSave })}

            <BrowserSettingsDialog
                canSave={canSave}
                draft={draft}
                error={error}
                isSaving={isSaving}
                onDraftChange={setDraft}
                onOpenBrowser={onOpenBrowser}
                onOpenChange={setSettingsDialogOpen}
                onRestartBrowser={onRestartBrowser}
                onSave={() => requestSave(toSaveInput(currentSettings, normalized))}
                open={settingsDialogOpen}
                settings={currentSettings}
                setupError={setupError}
            />

            <Dialog onOpenChange={setReplaceDialogOpen} open={replaceDialogOpen}>
                <DialogContent showCloseButton={false}>
                    <BrowserSkillConflictDialog
                        isSaving={isSaving}
                        onCancel={() => setReplaceDialogOpen(false)}
                        onReplace={() => {
                            if (!pendingSave) {
                                return;
                            }
                            void onSave(pendingSave);
                            setPendingSave(null);
                            setReplaceDialogOpen(false);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

function BrowserPluginRow({
    isSaving,
    onEnabledChange,
    onSelect,
    settings,
}: {
    isSaving: boolean;
    onEnabledChange: (enabled: boolean) => void;
    onSelect: () => void;
    settings: BrowserSettings;
}) {
    return (
        <SettingsRow
            description={browserPluginManifest.description}
            title={
                <span
                    className={cn(
                        'flex min-w-0 items-center gap-2',
                        !settings.enabled && 'opacity-45'
                    )}
                >
                    <Icon className="size-5" icon={PlugIcon} />
                    <span className="truncate">Browser</span>
                    {settings.skillConflict ? (
                        <Badge size="sm" variant="warning">
                            Skill conflict
                        </Badge>
                    ) : null}
                </span>
            }
            trailingWidth="intrinsic"
        >
            <div className="flex items-center gap-2">
                <Button disabled={isSaving} onClick={() => onSelect()} variant="ghost">
                    Configure
                </Button>
                <PluginEnablementSwitch
                    aria-label={`${settings.enabled ? 'Disable' : 'Enable'} Browser`}
                    checked={settings.enabled}
                    disabled={isSaving}
                    lockReason={null}
                    onCheckedChange={onEnabledChange}
                />
            </div>
        </SettingsRow>
    );
}

function BrowserPluginSkeleton() {
    return (
        <SettingsRow
            description={<Skeleton className="h-3 w-72 max-w-full" />}
            title={<Skeleton className="h-4 w-32" />}
            trailingWidth="intrinsic"
        >
            <Skeleton className="h-8 w-28" />
        </SettingsRow>
    );
}

function BrowserSkillConflictDialog({
    isSaving,
    onCancel,
    onReplace,
}: {
    isSaving: boolean;
    onCancel: () => void;
    onReplace: () => void;
}) {
    return (
        <>
            <DialogHeader>
                <DialogTitle>Replace existing skill?</DialogTitle>
                <DialogDescription>
                    Enabling Browser reserves the browser skill so the agent gets the right tools
                    and widget guidance.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter variant="bare">
                <Button disabled={isSaving} onClick={onCancel} variant="ghost">
                    Cancel
                </Button>
                <Button loading={isSaving} onClick={onReplace} type="button" variant="destructive">
                    Replace skill
                </Button>
            </DialogFooter>
        </>
    );
}
