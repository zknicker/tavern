import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { AgentRuntimeSaveMerchbaseSettings } from '@tavern/api';
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
import { FluidList, FluidListItem } from '../../../components/ui/fluid-list.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
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

    if (isLoading) {
        return <MerchbasePluginSkeleton />;
    }

    if (!settings) {
        return (
            <div className="-mx-3 rounded-xl px-3 py-2.5 text-muted-foreground text-sm">
                {error ?? 'Tavern Runtime unavailable.'}
            </div>
        );
    }

    const normalized = normalizeDraft(draft);
    const hasChanges = hasDraftChanges(settings, normalized);
    const needsReplaceConfirmation = Boolean(settings.skillConflict && normalized.enabled);
    const canSave = hasChanges || needsReplaceConfirmation;

    function openSettingsDialog() {
        setDraft(createDraft(settings));
        setPendingSave(null);
        setReplaceDialogOpen(false);
        setSettingsDialogOpen(true);
    }

    function requestSave(input: AgentRuntimeSaveMerchbaseSettings) {
        if (settings?.skillConflict && input.enabled === true) {
            setPendingSave(input);
            setReplaceDialogOpen(true);
            return;
        }
        void onSave(input);
    }

    return (
        <>
            <FluidList className="grid">
                <FluidListItem className="-mx-3" index={0}>
                    <MerchbasePluginRow
                        isSaving={isSaving}
                        onEnabledChange={(enabled) => requestSave({ enabled })}
                        onSelect={openSettingsDialog}
                        settings={settings}
                    />
                </FluidListItem>
            </FluidList>

            <MerchbaseSettingsDialog
                canSave={canSave}
                draft={draft}
                error={error}
                isSaving={isSaving}
                onDraftChange={setDraft}
                onOpenChange={setSettingsDialogOpen}
                onSave={() => requestSave(toSaveInput(normalized))}
                open={settingsDialogOpen}
                settings={settings}
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
        <div className="flex select-none items-center gap-4 rounded-xl px-3 py-2.5">
            <button
                className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onSelect}
                type="button"
            >
                <span
                    className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border/50 bg-muted/40 text-muted-foreground',
                        !settings.enabled && 'opacity-45'
                    )}
                >
                    <Icon className="size-5" icon={PlugIcon} />
                </span>
                <span className={cn('min-w-0 flex-1', !settings.enabled && 'opacity-45')}>
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-[15px] text-foreground">
                            MerchBase
                        </span>
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
                    <span className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                        Live sales data for Rich Responses and agent reads.
                    </span>
                </span>
            </button>
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
        <div className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-2.5">
            <Skeleton className="size-10 rounded-[10px]" />
            <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-72 max-w-full" />
            </div>
        </div>
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
