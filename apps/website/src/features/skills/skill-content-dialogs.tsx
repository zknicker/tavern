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
    installing,
    name,
    onKeep,
    onOpenChange,
    onReplace,
    open,
}: {
    installing: boolean;
    name: string;
    onKeep: () => void;
    onOpenChange: (open: boolean) => void;
    onReplace: () => void;
    open: boolean;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Keep your changes?</DialogTitle>
                    <DialogDescription>
                        {formatSkillName(name)} was edited since it was installed, by you or an
                        agent. Updating replaces those edits with the Tavern version.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={onKeep} variant="secondary">
                        Keep my version
                    </Button>
                    <Button disabled={installing} onClick={onReplace}>
                        {installing ? <Spinner className="size-4" /> : null}
                        Replace with Tavern version
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ResetConfirmDialog({
    name,
    onConfirm,
    onOpenChange,
    open,
    resetting,
}: {
    name: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    resetting: boolean;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Reset to default?</DialogTitle>
                    <DialogDescription>
                        This restores {formatSkillName(name)} to the current Tavern default,
                        replacing any edits made by you or an agent.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} variant="secondary">
                        Cancel
                    </Button>
                    <Button disabled={resetting} onClick={onConfirm}>
                        {resetting ? <Spinner className="size-4" /> : null}
                        Reset to default
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
