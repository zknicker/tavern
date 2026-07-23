import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';

interface CancelReminderDialogProps {
    errorMessage: string | null;
    isOpen: boolean;
    isPending: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    reminderName: string | null;
}

// Ported from cron-delete-dialog.tsx (delete → cancel). Reminders can't be
// deleted, only canceled so they stop firing (D4 immutability posture).
export function CancelReminderDialog({
    errorMessage,
    isOpen,
    isPending,
    onClose,
    onConfirm,
    reminderName,
}: CancelReminderDialogProps) {
    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!(nextOpen || isPending)) {
                    onClose();
                }
            }}
            open={isOpen}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cancel reminder?</DialogTitle>
                    <DialogDescription>
                        {`Cancel "${reminderName ?? 'this reminder'}"? It will not fire again. This cannot be undone.`}
                    </DialogDescription>
                </DialogHeader>
                {errorMessage ? (
                    <div className="px-6">
                        <Alert variant="error">
                            <Icon icon={AlertCircleIcon} />
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    </div>
                ) : null}
                <DialogFooter variant="bare">
                    <Button disabled={isPending} onClick={onClose} type="button" variant="ghost">
                        Keep reminder
                    </Button>
                    <Button
                        loading={isPending}
                        onClick={() => {
                            void onConfirm();
                        }}
                        type="button"
                        variant="destructive"
                    >
                        Cancel reminder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
