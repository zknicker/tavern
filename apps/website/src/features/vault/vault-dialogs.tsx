import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';

export type VaultPathDialogMode = 'folder' | 'page';

export interface VaultPathDialogState {
    mode: VaultPathDialogMode;
    parentPath?: string;
    title: string;
}

export function VaultPathDialog({
    errorMessage,
    isPending,
    onClose,
    onSubmit,
    state,
}: {
    errorMessage: string | null;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (path: string) => Promise<void>;
    state: VaultPathDialogState | null;
}) {
    const [pathValue, setPathValue] = React.useState('');
    const open = state !== null;

    React.useEffect(() => {
        if (open) {
            setPathValue('');
        }
    }, [open]);

    const label = state?.mode === 'folder' ? 'Folder path' : 'Page path';

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!(nextOpen || isPending)) {
                    onClose();
                }
            }}
            open={open}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{state?.title ?? 'Memory path'}</DialogTitle>
                    <DialogDescription>
                        {state?.parentPath ? `Under ${state.parentPath}.` : 'At the Memory root.'}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const path = pathValue.trim();
                        if (path) {
                            void onSubmit(path);
                        }
                    }}
                >
                    <label className="block space-y-1.5">
                        <span className="font-medium text-sm">{label}</span>
                        <Input
                            autoFocus
                            disabled={isPending}
                            onChange={(event) => setPathValue(event.currentTarget.value)}
                            placeholder={state?.mode === 'folder' ? 'Projects' : 'Projects/Plan'}
                            value={pathValue}
                        />
                    </label>
                    {errorMessage ? (
                        <p className="text-destructive-foreground text-sm">{errorMessage}</p>
                    ) : null}
                    <DialogFooter variant="bare">
                        <Button disabled={isPending} onClick={onClose} variant="secondary">
                            Cancel
                        </Button>
                        <Button disabled={!pathValue.trim()} loading={isPending} type="submit">
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export interface VaultDeleteTarget {
    kind: 'folder' | 'page';
    path: string;
    title: string;
}

export function VaultDeleteDialog({
    errorMessage,
    isPending,
    onClose,
    onDelete,
    target,
}: {
    errorMessage: string | null;
    isPending: boolean;
    onClose: () => void;
    onDelete: () => Promise<void>;
    target: VaultDeleteTarget | null;
}) {
    return (
        <Dialog
            onOpenChange={(open) => {
                if (!(open || isPending)) {
                    onClose();
                }
            }}
            open={target !== null}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete {target?.title ?? 'memory item'}?</DialogTitle>
                    <DialogDescription>
                        {target?.kind === 'folder'
                            ? 'This deletes the folder and all Markdown pages inside it.'
                            : 'This deletes the Markdown page from Memory.'}
                    </DialogDescription>
                </DialogHeader>
                {errorMessage ? (
                    <p className="text-destructive-foreground text-sm">{errorMessage}</p>
                ) : null}
                <DialogFooter variant="bare">
                    <Button disabled={isPending} onClick={onClose} variant="secondary">
                        Cancel
                    </Button>
                    <Button
                        loading={isPending}
                        onClick={() => void onDelete()}
                        variant="destructive"
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
