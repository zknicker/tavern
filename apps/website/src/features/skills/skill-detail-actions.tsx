import {
    AddCircleIcon,
    ArrowReloadHorizontalIcon,
    Delete02Icon,
    MoreHorizontalIcon,
    RefreshIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { useSkillHubInstall } from '../../hooks/skills/use-skill-hub-install.ts';
import { useSkillHubUninstall } from '../../hooks/skills/use-skill-hub-uninstall.ts';
import { useSkillReset } from '../../hooks/skills/use-skill-reset.ts';
import {
    ResetConfirmDialog,
    showSkillFailureToast,
    UpdateConflictDialog,
} from './skill-content-dialogs.tsx';
import type { SkillTreeSubject } from './skill-tree-model.ts';

/** The seeded skill is the only skill with a Tavern default to reset to. */
const seededSkillId = 'tavern-agent';

export interface SkillEnablementController {
    error: null | { message: string };
    isPending: boolean;
    mutate: (input: { enabled: boolean; skillId: string }) => void;
}

export function SkillDetailActions({
    setEnabled,
    scanBlocked,
    subject,
}: {
    scanBlocked: boolean;
    setEnabled: SkillEnablementController;
    subject: SkillTreeSubject;
}) {
    const install = useSkillHubInstall();
    const uninstall = useSkillHubUninstall();
    const reset = useSkillReset();
    const [conflictOpen, setConflictOpen] = React.useState(false);
    const [resetOpen, setResetOpen] = React.useState(false);

    const canUninstall = Boolean(subject.installed && subject.uninstallName);
    const canReset = subject.installed && subject.skillId === seededSkillId;
    const showUpdate = subject.installed && subject.updateAvailable && Boolean(subject.identifier);
    const showInstall = !subject.installed && Boolean(subject.identifier);
    const mutationBusy = install.isPending || uninstall.isPending || reset.isPending;

    function runUpdate(force: boolean) {
        if (!subject.identifier) {
            return;
        }
        install.mutate(
            { force, identifier: subject.identifier },
            {
                onError: (error) => showSkillFailureToast('Update failed', error),
                onSuccess: (result) => {
                    if (result.conflict) {
                        setConflictOpen(true);
                        return;
                    }
                    setConflictOpen(false);
                    toastManager.add({ title: 'Skill updated', type: 'success' });
                },
            }
        );
    }

    function runReset() {
        if (!subject.skillId) {
            return;
        }
        reset.mutate(
            { skillId: subject.skillId },
            {
                onError: (error) => showSkillFailureToast('Reset failed', error),
                onSuccess: () => {
                    setResetOpen(false);
                    toastManager.add({ title: 'Skill reset to default', type: 'success' });
                },
            }
        );
    }

    function runUninstall() {
        if (!subject.uninstallName) {
            return;
        }
        uninstall.mutate(
            { name: subject.uninstallName },
            { onError: (error) => showSkillFailureToast('Uninstall failed', error) }
        );
    }

    return (
        <div className="flex shrink-0 items-center gap-1.5">
            {subject.installed && subject.skillId && !subject.readOnly ? (
                <Switch
                    aria-label={`${subject.enabled ? 'Disable' : 'Enable'} ${subject.name}`}
                    checked={subject.enabled === true}
                    className="data-[checked]:bg-success"
                    disabled={setEnabled.isPending}
                    onCheckedChange={(checked) =>
                        setEnabled.mutate({ enabled: checked, skillId: subject.skillId! })
                    }
                />
            ) : null}
            {showUpdate ? (
                <Button
                    disabled={install.isPending}
                    onClick={() => runUpdate(false)}
                    size="sm"
                    variant="secondary"
                >
                    {install.isPending ? (
                        <Spinner className="size-4" />
                    ) : (
                        <Icon icon={RefreshIcon} />
                    )}
                    Update
                </Button>
            ) : null}
            {showInstall ? (
                <Button
                    disabled={install.isPending || scanBlocked}
                    onClick={() => runUpdate(false)}
                    size="sm"
                    title={scanBlocked ? 'The security scan blocked this skill.' : undefined}
                >
                    {install.isPending ? (
                        <Spinner className="size-4" />
                    ) : (
                        <Icon icon={AddCircleIcon} />
                    )}
                    Install
                </Button>
            ) : null}
            {canUninstall || canReset ? (
                <Menu>
                    <MenuTrigger
                        render={
                            <Button
                                aria-label={`${subject.name} actions`}
                                className="text-foreground"
                                size="icon-sm"
                                title="Skill actions"
                                variant="ghost"
                            />
                        }
                    >
                        <Icon className="size-4" icon={MoreHorizontalIcon} />
                    </MenuTrigger>
                    <MenuPopup align="end">
                        {canReset ? (
                            <MenuItem disabled={mutationBusy} onClick={() => setResetOpen(true)}>
                                <Icon className="size-4" icon={ArrowReloadHorizontalIcon} />
                                Reset to default
                            </MenuItem>
                        ) : null}
                        {canUninstall ? (
                            <MenuItem disabled={mutationBusy} onClick={runUninstall}>
                                {uninstall.isPending ? (
                                    <Spinner className="size-4" />
                                ) : (
                                    <Icon className="size-4" icon={Delete02Icon} />
                                )}
                                Uninstall
                            </MenuItem>
                        ) : null}
                    </MenuPopup>
                </Menu>
            ) : null}

            <UpdateConflictDialog
                installing={install.isPending}
                name={subject.name}
                onKeep={() => setConflictOpen(false)}
                onOpenChange={setConflictOpen}
                onReplace={() => runUpdate(true)}
                open={conflictOpen}
            />
            <ResetConfirmDialog
                name={subject.name}
                onConfirm={runReset}
                onOpenChange={setResetOpen}
                open={resetOpen}
                resetting={reset.isPending}
            />
        </div>
    );
}
