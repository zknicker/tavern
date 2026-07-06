import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { AgentRuntimeSaveMerchbaseSettings } from '@tavern/api';
import { merchbasePluginManifest } from '@tavern/api/plugins/merchbase';
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
import { Switch } from '../../../components/ui/switch.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip.tsx';
import type { MerchbaseSettingsOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { merchbaseEnvironmentLockTooltip } from './merchbase-settings-copy.ts';
import { MerchbaseSettingsDialog } from './merchbase-settings-dialog.tsx';
import {
    createDraft,
    hasDraftChanges,
    type MerchbaseSettingsDraft,
    normalizeDraft,
    toSaveInput,
} from './merchbase-settings-model.ts';

type MerchbaseSettings = NonNullable<MerchbaseSettingsOutput>;
type MerchbaseSettingsControlRender = (control: {
    openSettingsDialog: (nextDraft?: Partial<MerchbaseSettingsDraft>) => void;
    requestSave: (input: AgentRuntimeSaveMerchbaseSettings) => void;
}) => React.ReactNode;

export function MerchbaseSettingsCard({
    error,
    isLoading = false,
    isSaving = false,
    onSave,
    settings,
}: {
    error?: string | null;
    isLoading?: boolean;
    isSaving?: boolean;
    onSave: (input: AgentRuntimeSaveMerchbaseSettings) => Promise<unknown> | undefined;
    settings: MerchbaseSettings | null;
}) {
    if (isLoading) {
        return <MerchbasePluginSkeleton />;
    }

    if (!settings) {
        return (
            <SettingsRow
                description={error ?? 'Tavern Runtime unavailable.'}
                title="MerchBase"
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
        <MerchbaseSettingsControl
            error={error}
            isSaving={isSaving}
            onSave={onSave}
            settings={currentSettings}
        >
            {({ openSettingsDialog, requestSave }) => {
                function handleEnabledChange(enabled: boolean) {
                    if (enabled && !currentSettings.apiKeyConfigured) {
                        openSettingsDialog({ enabled: true });
                        return;
                    }

                    requestSave({ enabled });
                }

                return (
                    <MerchbasePluginRow
                        isSaving={isSaving}
                        onEnabledChange={handleEnabledChange}
                        onSelect={openSettingsDialog}
                        settings={currentSettings}
                    />
                );
            }}
        </MerchbaseSettingsControl>
    );
}

export function MerchbaseSettingsControl({
    children,
    error,
    isSaving,
    onSave,
    settings,
}: {
    children: MerchbaseSettingsControlRender;
    error?: string | null;
    isSaving: boolean;
    onSave: (input: AgentRuntimeSaveMerchbaseSettings) => Promise<unknown> | undefined;
    settings: MerchbaseSettings;
}) {
    const [draft, setDraft] = React.useState<MerchbaseSettingsDraft>(() => createDraft(settings));
    const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
    const [replaceDialogOpen, setReplaceDialogOpen] = React.useState(false);
    const [pendingSave, setPendingSave] = React.useState<AgentRuntimeSaveMerchbaseSettings | null>(
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
    const missingEnabledSetup = normalized.enabled && !normalized.apiKey;
    const canSave = !missingEnabledSetup && (hasChanges || needsReplaceConfirmation);
    const setupError = missingEnabledSetup ? 'Add a MerchBase API key before enabling.' : null;

    function openSettingsDialog(nextDraft?: Partial<MerchbaseSettingsDraft>) {
        setDraft({ ...createDraft(currentSettings), ...nextDraft });
        setPendingSave(null);
        setReplaceDialogOpen(false);
        setSettingsDialogOpen(true);
    }

    function requestSave(input: AgentRuntimeSaveMerchbaseSettings) {
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

            <MerchbaseSettingsDialog
                canSave={canSave}
                draft={draft}
                error={error}
                isSaving={isSaving}
                onDraftChange={setDraft}
                onOpenChange={setSettingsDialogOpen}
                onSave={() => requestSave(toSaveInput(currentSettings, normalized))}
                open={settingsDialogOpen}
                settings={currentSettings}
                setupError={setupError}
            />

            <Dialog onOpenChange={setReplaceDialogOpen} open={replaceDialogOpen}>
                <DialogContent showCloseButton={false}>
                    <MerchbaseSkillConflictDialog
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

function MerchbasePluginRow({
    isSaving,
    onEnabledChange,
    onSelect,
    settings,
}: {
    isSaving: boolean;
    onEnabledChange: (enabled: boolean) => void;
    onSelect: () => void;
    settings: MerchbaseSettings;
}) {
    const environmentControlled = settings.enablementSource === 'environment';

    return (
        <SettingsRow
            description={merchbasePluginManifest.description}
            title={
                <span
                    className={cn(
                        'flex min-w-0 items-center gap-2',
                        !settings.enabled && 'opacity-45'
                    )}
                >
                    <Icon className="size-5" icon={PlugIcon} />
                    <span className="truncate">MerchBase</span>
                    {settings.skillConflict ? (
                        <Badge size="sm" variant="warning">
                            Skill conflict
                        </Badge>
                    ) : null}
                    {settings.apiKeyConfigured ? null : (
                        <Badge size="sm" variant="error">
                            Needs setup
                        </Badge>
                    )}
                </span>
            }
            trailingWidth="intrinsic"
        >
            <div className="flex items-center gap-2">
                <Button disabled={isSaving} onClick={() => onSelect()} variant="ghost">
                    {settings.apiKeyConfigured ? 'Configure' : 'Set up'}
                </Button>
                <MerchbaseEnablementSwitch
                    aria-label={
                        environmentControlled
                            ? 'MerchBase enablement is managed by local Tavern configuration'
                            : `${settings.enabled ? 'Disable' : 'Enable'} MerchBase`
                    }
                    checked={settings.enabled}
                    disabled={isSaving || environmentControlled}
                    environmentControlled={environmentControlled}
                    onCheckedChange={onEnabledChange}
                />
            </div>
        </SettingsRow>
    );
}

function MerchbaseEnablementSwitch({
    environmentControlled,
    ...props
}: React.ComponentProps<typeof Switch> & {
    environmentControlled: boolean;
}) {
    const control = <Switch {...props} />;

    if (!environmentControlled) {
        return control;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
                {control}
            </TooltipTrigger>
            <TooltipContent className="max-w-64" side="left">
                {merchbaseEnvironmentLockTooltip}
            </TooltipContent>
        </Tooltip>
    );
}

function MerchbasePluginSkeleton() {
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

function MerchbaseSkillConflictDialog({
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
                    Enabling MerchBase reserves the merchbase skill so the agent gets the right
                    tools and widget guidance.
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
