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
import { ModelAccessProviderRow } from './model-access-provider-row.tsx';

interface OpenAiApiRowProps {
    apiKey: string;
    hasApiKey: boolean;
    isLoading: boolean;
    onRemove: () => void;
    onSave: (value: { apiKey: string }) => void;
    removePending: boolean;
    saveError: string | null;
    savePending: boolean;
}

export function OpenAiApiRow({
    apiKey,
    hasApiKey,
    isLoading,
    onRemove,
    onSave,
    removePending,
    saveError,
    savePending,
}: OpenAiApiRowProps) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const providerConfig = getModelProviderConfigFromAccessId('openai');
    const description = isLoading ? 'Loading OpenAI API key.' : '';

    return (
        <>
            <ModelAccessProviderRow
                color={providerConfig.color}
                description={description}
                error={saveError}
                icon={providerConfig.icon}
                label={providerConfig.accessDisplayName}
                state={hasApiKey ? 'live' : 'needs-auth'}
                target={hasApiKey ? 'tavern-vault' : undefined}
            >
                {hasApiKey ? (
                    <>
                        <Button
                            disabled={savePending || removePending}
                            onClick={() => setDialogOpen(true)}
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            Update
                        </Button>
                        <Button
                            disabled={savePending || removePending}
                            onClick={onRemove}
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            Remove
                        </Button>
                    </>
                ) : (
                    <Button
                        disabled={savePending}
                        onClick={() => setDialogOpen(true)}
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        Add key
                    </Button>
                )}
            </ModelAccessProviderRow>

            <OpenAiApiDialog
                apiKey={apiKey}
                hasApiKey={hasApiKey}
                onOpenChange={setDialogOpen}
                onSave={onSave}
                open={dialogOpen}
                savePending={savePending}
            />
        </>
    );
}

function OpenAiApiDialog({
    apiKey,
    hasApiKey,
    onOpenChange,
    onSave,
    open,
    savePending,
}: {
    apiKey: string;
    hasApiKey: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (value: { apiKey: string }) => void;
    open: boolean;
    savePending: boolean;
}) {
    const [localApiKey, setLocalApiKey] = React.useState(apiKey);

    React.useEffect(() => {
        if (open) {
            setLocalApiKey(apiKey);
        }
    }, [open, apiKey]);

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update API Key</DialogTitle>
                    <DialogDescription>
                        OpenAI API keys are saved in Tavern Vault.
                    </DialogDescription>
                </DialogHeader>

                <DialogPanel>
                    <div className="space-y-2">
                        <Label htmlFor="openai-api-key">API Key</Label>
                        <Input
                            id="openai-api-key"
                            onChange={(event) => setLocalApiKey(event.target.value)}
                            placeholder={hasApiKey ? 'Saved in Tavern Vault' : 'sk-...'}
                            type="text"
                            value={localApiKey}
                        />
                    </div>
                </DialogPanel>

                <DialogFooter variant="bare">
                    <Button
                        disabled={savePending}
                        onClick={() => {
                            onSave({ apiKey: localApiKey });
                            onOpenChange(false);
                        }}
                        size="sm"
                        type="button"
                    >
                        Save
                    </Button>
                    <Button
                        disabled={savePending}
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
