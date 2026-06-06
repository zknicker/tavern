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
import { getModelProviderConfig } from '../../../lib/model-provider-config.ts';
import { ModelAccessProviderRow } from './model-access-provider-row.tsx';

interface OpenRouterRowProps {
    apiKey: string;
    hasApiKey: boolean;
    hasManagementApiKey: boolean;
    isLoading: boolean;
    managementApiKey: string;
    onRemove: () => void;
    onSave: (value: { apiKey: string; managementApiKey: string }) => void;
    removePending: boolean;
    saveError: string | null;
    savePending: boolean;
}

export function OpenRouterRow({
    apiKey,
    hasApiKey,
    hasManagementApiKey,
    managementApiKey,
    isLoading,
    onRemove,
    onSave,
    removePending,
    saveError,
    savePending,
}: OpenRouterRowProps) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const providerConfig = getModelProviderConfig('openrouter');
    const hasSavedKeys = hasApiKey || hasManagementApiKey;
    const isConnected = hasApiKey;
    const description = getOpenRouterDescription(isLoading);

    return (
        <>
            <ModelAccessProviderRow
                color={providerConfig.color}
                description={description}
                error={saveError}
                icon={providerConfig.icon}
                label={providerConfig.displayName}
                state={isConnected ? 'live' : 'needs-auth'}
                target={isConnected ? 'tavern-vault' : undefined}
            >
                {hasSavedKeys ? (
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

            <OpenRouterDialog
                apiKey={apiKey}
                hasSavedKeys={hasSavedKeys}
                managementApiKey={managementApiKey}
                onOpenChange={setDialogOpen}
                onSave={onSave}
                open={dialogOpen}
                savePending={savePending}
            />
        </>
    );
}

function OpenRouterDialog({
    apiKey,
    hasSavedKeys,
    managementApiKey,
    onSave,
    open,
    onOpenChange,
    savePending,
}: {
    apiKey: string;
    hasSavedKeys: boolean;
    managementApiKey: string;
    onSave: (value: { apiKey: string; managementApiKey: string }) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    savePending: boolean;
}) {
    const [localApiKey, setLocalApiKey] = React.useState(apiKey);
    const [localManagementKey, setLocalManagementKey] = React.useState(managementApiKey);

    React.useEffect(() => {
        if (open) {
            setLocalApiKey(apiKey);
            setLocalManagementKey(managementApiKey);
        }
    }, [open, apiKey, managementApiKey]);

    const handleSave = () => {
        onSave({
            apiKey: localApiKey,
            managementApiKey: localManagementKey,
        });
        onOpenChange(false);
    };

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update API Keys</DialogTitle>
                    <DialogDescription>
                        OpenRouter API keys are saved in Tavern Vault.
                    </DialogDescription>
                </DialogHeader>

                <DialogPanel>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="openrouter-api-key">API Key</Label>
                            <Input
                                id="openrouter-api-key"
                                onChange={(event) => setLocalApiKey(event.target.value)}
                                placeholder={
                                    hasSavedKeys ? 'Saved in Tavern Vault' : 'sk-or-v1-...'
                                }
                                type="text"
                                value={localApiKey}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="openrouter-management-key">Management Key</Label>
                            <Input
                                id="openrouter-management-key"
                                onChange={(event) => setLocalManagementKey(event.target.value)}
                                placeholder={
                                    hasSavedKeys ? 'Saved in Tavern Vault' : 'sk-or-v1-...'
                                }
                                type="text"
                                value={localManagementKey}
                            />
                        </div>
                    </div>
                </DialogPanel>

                <DialogFooter variant="bare">
                    <Button disabled={savePending} onClick={handleSave} size="sm" type="button">
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

function getOpenRouterDescription(isLoading: boolean) {
    if (isLoading) {
        return 'Loading OpenRouter keys.';
    }

    return '';
}
