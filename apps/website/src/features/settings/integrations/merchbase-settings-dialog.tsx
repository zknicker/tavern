import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import type { MerchbaseSettingsOutput } from '../../../lib/trpc.tsx';
import type { MerchbaseSettingsDraft } from './merchbase-settings-model.ts';

type MerchbaseSettings = NonNullable<MerchbaseSettingsOutput>;

export function MerchbaseSettingsDialogBody({
    canSave,
    draft,
    error,
    isSaving,
    onDraftChange,
    onSave,
    settings,
}: {
    canSave: boolean;
    draft: MerchbaseSettingsDraft;
    error?: string | null;
    isSaving: boolean;
    onDraftChange: Dispatch<SetStateAction<MerchbaseSettingsDraft>>;
    onSave: () => void;
    settings: MerchbaseSettings;
}) {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                if (canSave) {
                    onSave();
                }
            }}
        >
            <DialogHeader>
                <DialogTitle>MerchBase</DialogTitle>
                <DialogDescription>
                    Configure the Integration that powers MerchBase agent tools and sales widgets.
                </DialogDescription>
            </DialogHeader>

            <DialogPanel className="grid gap-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3">
                    <div className="space-y-0.5">
                        <div className="font-medium text-foreground text-sm">Enable MerchBase</div>
                        <div className="text-muted-foreground text-sm">
                            Makes the skill, toolset, and widgets available to the agent.
                        </div>
                    </div>
                    <Switch
                        aria-label="Enable MerchBase"
                        checked={draft.enabled}
                        disabled={isSaving}
                        onCheckedChange={(enabled) =>
                            onDraftChange((current) => ({ ...current, enabled }))
                        }
                    />
                </div>

                <DialogField description="Defaults to MerchBase production." label="Base URL">
                    <Input
                        aria-label="MerchBase base URL"
                        className="font-mono"
                        disabled={isSaving}
                        onChange={(event) =>
                            onDraftChange((current) => ({
                                ...current,
                                baseUrl: event.currentTarget.value,
                            }))
                        }
                        value={draft.baseUrl}
                    />
                </DialogField>

                <DialogField
                    description="Optional account header for multi-account setups."
                    label="Default account"
                >
                    <Input
                        aria-label="MerchBase default account"
                        disabled={isSaving}
                        onChange={(event) =>
                            onDraftChange((current) => ({
                                ...current,
                                defaultAccount: event.currentTarget.value,
                            }))
                        }
                        placeholder="Use MerchBase default"
                        value={draft.defaultAccount}
                    />
                </DialogField>

                <DialogField
                    description="Optional marketplace fallback for sales reads."
                    label="Default marketplace"
                >
                    <Input
                        aria-label="MerchBase default marketplace"
                        disabled={isSaving}
                        onChange={(event) =>
                            onDraftChange((current) => ({
                                ...current,
                                defaultMarketplace: event.currentTarget.value,
                            }))
                        }
                        placeholder="Use MerchBase default"
                        value={draft.defaultMarketplace}
                    />
                </DialogField>

                <DialogField
                    description={
                        settings.apiKeyConfigured
                            ? 'Leave blank to keep the existing key.'
                            : 'Required before the Integration can be healthy.'
                    }
                    label="API key"
                >
                    <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                            aria-label="MerchBase API key"
                            className="font-mono sm:flex-1"
                            disabled={isSaving}
                            onChange={(event) =>
                                onDraftChange((current) => ({
                                    ...current,
                                    apiKey: event.currentTarget.value,
                                    clearApiKey: false,
                                }))
                            }
                            placeholder={settings.apiKeyConfigured ? 'Configured' : 'Paste API key'}
                            type="password"
                            value={draft.apiKey}
                        />
                        <Button
                            disabled={isSaving || !settings.apiKeyConfigured}
                            onClick={() =>
                                onDraftChange((current) => ({
                                    ...current,
                                    apiKey: '',
                                    clearApiKey: true,
                                }))
                            }
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            Clear
                        </Button>
                    </div>
                </DialogField>

                {settings.skillConflict ? (
                    <div className="rounded-xl border border-warning/25 bg-warning/8 px-3.5 py-3 text-sm">
                        <div className="font-medium text-foreground">Skill conflict</div>
                        <div className="mt-1 text-muted-foreground">
                            Existing skill at{' '}
                            <span className="font-mono">{settings.skillConflict.skillPath}</span>.
                            Enabling MerchBase will replace it after confirmation.
                        </div>
                    </div>
                ) : null}

                {error ? <p className="text-error text-sm">{error}</p> : null}
            </DialogPanel>

            <DialogFooter>
                <div className="mr-auto flex items-center text-muted-foreground text-sm">
                    {settings.apiKeyConfigured && !draft.clearApiKey
                        ? 'API key configured'
                        : 'API key missing'}
                </div>
                <Button disabled={!canSave || isSaving} loading={isSaving} type="submit">
                    Save
                </Button>
            </DialogFooter>
        </form>
    );
}

function DialogField({
    children,
    description,
    label,
}: {
    children: ReactNode;
    description: ReactNode;
    label: ReactNode;
}) {
    return (
        <label className="grid gap-2">
            <span className="space-y-0.5">
                <span className="block font-medium text-foreground text-sm">{label}</span>
                <span className="block text-muted-foreground text-sm">{description}</span>
            </span>
            {children}
        </label>
    );
}
