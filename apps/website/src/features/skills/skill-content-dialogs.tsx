import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { formatSkillName } from './skill-name-format.ts';

export function UpdateConflictDialog({
    busy,
    name,
    onKeep,
    onOpenChange,
    onReplace,
    open,
    restoreTarget,
}: {
    busy: boolean;
    name: string;
    onKeep: () => void;
    onOpenChange: (open: boolean) => void;
    onReplace: () => void;
    open: boolean;
    restoreTarget: string;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Keep your changes?</DialogTitle>
                    <DialogDescription>
                        {formatSkillName(name)} was edited since it was installed, by you or an
                        agent. Updating replaces those edits with {restoreTarget}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={onKeep} variant="secondary">
                        Keep my version
                    </Button>
                    <Button disabled={busy} onClick={onReplace}>
                        {busy ? <Spinner className="size-4" /> : null}
                        Replace with Grotto version
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ResetConfirmDialog({
    actionLabel,
    name,
    onConfirm,
    onOpenChange,
    open,
    resetting,
    restoreTarget,
}: {
    actionLabel: string;
    name: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    resetting: boolean;
    restoreTarget: string;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{actionLabel}?</DialogTitle>
                    <DialogDescription>
                        This restores {formatSkillName(name)} to {restoreTarget}, replacing any
                        edits made by you or an agent.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} variant="secondary">
                        Cancel
                    </Button>
                    <Button disabled={resetting} onClick={onConfirm}>
                        {resetting ? <Spinner className="size-4" /> : null}
                        {actionLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function showSkillFailureToast(title: string, error: unknown) {
    toastManager.add({
        description: error instanceof Error ? error.message : 'Try again.',
        priority: 'high',
        title,
        type: 'error',
    });
}
