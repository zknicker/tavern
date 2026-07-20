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

interface CronDeleteDialogProps {
    errorMessage: string | null;
    isOpen: boolean;
    isPending: boolean;
    jobName: string | null;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export function CronDeleteDialog({
    errorMessage,
    isOpen,
    isPending,
    jobName,
    onClose,
    onConfirm,
}: CronDeleteDialogProps) {
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
                    <DialogTitle>Delete automation?</DialogTitle>
                    <DialogDescription>
                        {`Delete "${jobName ?? 'this automation'}"? This removes the automation from Grotto Runtime and cannot be undone.`}
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
                        Cancel
                    </Button>
                    <Button
                        loading={isPending}
                        onClick={() => {
                            void onConfirm();
                        }}
                        type="button"
                        variant="destructive"
                    >
                        Delete automation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
