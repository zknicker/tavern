import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Label } from '../../../components/ui/primitives/label.tsx';
import { getModelProviderConfigFromAccessId } from '../../../lib/model-provider-config.ts';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { ModelAccessProviderRow } from './model-access-provider-row.tsx';

interface ClaudeCredentialRowProps {
    access: ModelAccessOutput['providers'][number];
    isSaving: boolean;
    onSave: (credential: string) => void;
    saveError: string | null;
}

export function ClaudeCredentialRow({
    access,
    isSaving,
    onSave,
    saveError,
}: ClaudeCredentialRowProps) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const providerConfig = getModelProviderConfigFromAccessId(access.id);
    const label = providerConfig.accessDisplayName;
    const isLive = access.state === 'live';

    return (
        <>
            <ModelAccessProviderRow
                color={providerConfig.color}
                description={access.description}
                error={saveError}
                icon={providerConfig.icon}
                label={label}
                state={access.state}
                target={access.source === 'tavern-vault' ? 'tavern-vault' : undefined}
            >
                <Button
                    onClick={() => setDialogOpen(true)}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    {isLive ? 'Update' : 'Connect'}
                </Button>
            </ModelAccessProviderRow>

            <ClaudeCredentialDialog
                isSaving={isSaving}
                onOpenChange={setDialogOpen}
                onSave={onSave}
                open={dialogOpen}
            />
        </>
    );
}

function ClaudeCredentialDialog({
    isSaving,
    onOpenChange,
    onSave,
    open,
}: {
    isSaving: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (credential: string) => void;
    open: boolean;
}) {
    const [credential, setCredential] = React.useState('');
    const trimmedCredential = credential.trim();
    const canSave =
        trimmedCredential.startsWith('sk-ant-oat') || trimmedCredential.startsWith('sk-ant-api');

    React.useEffect(() => {
        if (open) {
            setCredential('');
        }
    }, [open]);

    const handleSave = () => {
        if (!canSave) {
            return;
        }
        onSave(trimmedCredential);
        onOpenChange(false);
    };

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect Claude</DialogTitle>
                    <DialogDescription>
                        Run claude setup-token and paste the token, or paste an Anthropic API key.
                    </DialogDescription>
                </DialogHeader>

                <DialogPanel>
                    <div className="space-y-2">
                        <Label htmlFor="claude-credential">Credential</Label>
                        <Input
                            id="claude-credential"
                            onChange={(event) => setCredential(event.target.value)}
                            placeholder="sk-ant-oat... or sk-ant-api..."
                            type="password"
                            value={credential}
                        />
                    </div>
                </DialogPanel>

                <DialogFooter variant="bare">
                    <Button
                        disabled={!canSave || isSaving}
                        onClick={handleSave}
                        size="sm"
                        type="button"
                    >
                        Save
                    </Button>
                    <Button
                        onClick={() => onOpenChange(false)}
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
