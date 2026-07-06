import { AddCircleIcon, CheckmarkCircle02Icon } from '@hugeicons-pro/core-stroke-rounded';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { useSkillHubAvailable } from '../../hooks/skills/use-skill-hub-available.ts';
import { useSkillHubInstall } from '../../hooks/skills/use-skill-hub-install.ts';
import type { SkillHubAvailableOutput, SkillHubItemOutput } from '../../lib/trpc.tsx';
import { showSkillFailureToast } from './skill-content-dialogs.tsx';
import { SkillTrustBadge } from './skill-hub-badges.tsx';
import { formatSkillName } from './skill-name-format.ts';

export function AddFromLibraryDialog({
    onOpenChange,
    open,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const availableQuery = useSkillHubAvailable({ enabled: open });
    const install = useSkillHubInstall();
    const items = collectLibraryItems(availableQuery.data);
    const installedByIdentifier = availableQuery.data?.installed ?? {};

    function onInstall(item: SkillHubItemOutput) {
        install.mutate(
            { force: false, identifier: item.identifier },
            {
                onError: (error) => showSkillFailureToast('Install failed', error),
                onSuccess: (result) => {
                    if (result.conflict) {
                        return;
                    }
                    toastManager.add({ title: 'Skill installed', type: 'success' });
                },
            }
        );
    }

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add from library</DialogTitle>
                    <DialogDescription>
                        Install a skill from the built-in library or a connected source. Installed
                        skills appear in your skills list.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid max-h-[60vh] gap-2 overflow-y-auto">
                    {availableQuery.isPending ? (
                        <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
                            <Spinner className="size-4" />
                            Loading library
                        </div>
                    ) : null}
                    {availableQuery.error ? (
                        <p className="text-error text-sm">{availableQuery.error.message}</p>
                    ) : null}
                    {!(availableQuery.isPending || availableQuery.error) && items.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No library skills are available. Add a source to browse more.
                        </p>
                    ) : null}
                    {items.map((item) => {
                        const installedEntry = installedByIdentifier[item.identifier];
                        const isInstalled = Boolean(installedEntry);
                        const pendingThis =
                            install.isPending && install.variables?.identifier === item.identifier;

                        return (
                            <div
                                className="flex items-start gap-3 rounded-xl border border-border/70 px-4 py-3"
                                key={item.identifier}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="truncate font-semibold text-foreground text-sm">
                                            {formatSkillName(item.name)}
                                        </span>
                                        <SkillTrustBadge trustLevel={item.trustLevel} />
                                    </div>
                                    {item.description ? (
                                        <p className="mt-1 text-muted-foreground text-sm leading-5">
                                            {item.description}
                                        </p>
                                    ) : null}
                                </div>
                                {isInstalled ? (
                                    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm">
                                        <Icon
                                            className="size-4 text-success"
                                            icon={CheckmarkCircle02Icon}
                                        />
                                        Installed
                                    </span>
                                ) : (
                                    <Button
                                        disabled={install.isPending}
                                        onClick={() => onInstall(item)}
                                        size="sm"
                                    >
                                        {pendingThis ? (
                                            <Spinner className="size-4" />
                                        ) : (
                                            <Icon icon={AddCircleIcon} />
                                        )}
                                        Install
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </DialogPanel>
            </DialogContent>
        </Dialog>
    );
}

function collectLibraryItems(available: SkillHubAvailableOutput | undefined) {
    if (!available) {
        return [];
    }
    return [...available.builtin, ...available.taps.flatMap((tap) => tap.skills)];
}
