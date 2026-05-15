import * as React from 'react';
import { useBlocker } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { useOpenClawSettingsDraft } from './provider.tsx';

export function OpenClawSettingsLeaveGuard() {
    const { hasChanges, isSaving, resetAll } = useOpenClawSettingsDraft();
    const blocker = useBlocker(
        ({ nextLocation }) =>
            hasChanges && !isSaving && !nextLocation.pathname.startsWith('/dashboard/settings')
    );

    React.useEffect(() => {
        if (!(hasChanges && !isSaving)) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges, isSaving]);

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open && blocker.state === 'blocked') {
                    blocker.reset();
                }
            }}
            open={blocker.state === 'blocked'}
        >
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Discard unsaved changes?</DialogTitle>
                </DialogHeader>
                <DialogPanel>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Your settings changes have not been saved.
                    </p>
                </DialogPanel>
                <DialogFooter>
                    <Button
                        onClick={() => {
                            blocker.reset?.();
                        }}
                        type="button"
                        variant="ghost"
                    >
                        Keep editing
                    </Button>
                    <Button
                        onClick={() => {
                            resetAll();
                            blocker.proceed?.();
                        }}
                        type="button"
                        variant="destructive"
                    >
                        Discard changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
