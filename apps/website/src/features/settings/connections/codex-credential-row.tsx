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
import { Label } from '../../../components/ui/primitives/label.tsx';
import { Textarea } from '../../../components/ui/textarea.tsx';
import { getModelProviderConfigFromAccessId } from '../../../lib/model-provider-config.ts';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { ModelAccessProviderRow } from './model-access-provider-row.tsx';

interface CodexCredentialRowProps {
    access: ModelAccessOutput['providers'][number];
    isSaving: boolean;
    onSave: (credential: string) => void;
    saveError: string | null;
}

export function CodexCredentialRow({
    access,
    isSaving,
    onSave,
    saveError,
}: CodexCredentialRowProps) {
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

            <CodexCredentialDialog
                isSaving={isSaving}
                onOpenChange={setDialogOpen}
                onSave={onSave}
                open={dialogOpen}
            />
        </>
    );
}

function CodexCredentialDialog({
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
    const canSave = isOpenAiApiKey(trimmedCredential) || isCodexAuthJson(trimmedCredential);

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
                    <DialogTitle>Connect Codex</DialogTitle>
                    <DialogDescription>
                        Paste the contents of Codex auth.json or an OpenAI API key.
                    </DialogDescription>
                </DialogHeader>

                <DialogPanel>
                    <div className="space-y-2">
                        <Label htmlFor="codex-credential">Credential</Label>
                        <Textarea
                            autoComplete="off"
                            className="font-mono text-xs"
                            id="codex-credential"
                            onChange={(event) => setCredential(event.target.value)}
                            placeholder='{"tokens":{"access_token":"..."}} or sk-...'
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

function isOpenAiApiKey(value: string): boolean {
    return value.startsWith('sk-') && !(value.startsWith('sk-ant-') || value.startsWith('sk-or-'));
}

function isCodexAuthJson(value: string): boolean {
    try {
        const parsed = JSON.parse(value) as { tokens?: { access_token?: unknown } };
        return (
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof parsed.tokens?.access_token === 'string' &&
            parsed.tokens.access_token.trim().length > 0
        );
    } catch {
        return false;
    }
}
