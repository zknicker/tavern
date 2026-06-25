import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { FieldError } from '../../../components/ui/primitives/field.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { SecretInput } from '../../../components/ui/secret-input.tsx';
import type { MerchbaseSettingsOutput } from '../../../lib/trpc.tsx';
import {
    IntegrationDialog,
    IntegrationField,
    IntegrationFieldRow,
    IntegrationLockSwitch,
    IntegrationNotice,
} from './integration-dialog.tsx';
import { merchbaseEnvironmentLockTooltip } from './merchbase-settings-copy.ts';
import type { MerchbaseSettingsDraft } from './merchbase-settings-model.ts';

type MerchbaseSettings = NonNullable<MerchbaseSettingsOutput>;

export function MerchbaseSettingsDialog({
    canSave,
    draft,
    error,
    isSaving,
    onDraftChange,
    onOpenChange,
    onSave,
    open,
    settings,
}: {
    canSave: boolean;
    draft: MerchbaseSettingsDraft;
    error?: string | null;
    isSaving: boolean;
    onDraftChange: Dispatch<SetStateAction<MerchbaseSettingsDraft>>;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    open: boolean;
    settings: MerchbaseSettings;
}) {
    const environmentControlled = settings.enablementSource === 'environment';
    const [apiKeyRevealed, setApiKeyRevealed] = useState(false);

    return (
        <IntegrationDialog
            description="Powers MerchBase agent tools and sales widgets."
            footer={
                <Button
                    className="ml-auto"
                    disabled={!canSave || isSaving}
                    loading={isSaving}
                    type="submit"
                >
                    Save
                </Button>
            }
            headerAction={
                <IntegrationLockSwitch
                    aria-label={
                        environmentControlled
                            ? 'MerchBase enablement is managed by local Tavern configuration'
                            : `${draft.enabled ? 'Disable' : 'Enable'} MerchBase`
                    }
                    checked={draft.enabled}
                    disabled={isSaving || environmentControlled}
                    locked={environmentControlled}
                    lockTooltip={merchbaseEnvironmentLockTooltip}
                    onCheckedChange={(enabled) =>
                        onDraftChange((current) => ({ ...current, enabled }))
                    }
                />
            }
            icon={PlugIcon}
            onOpenChange={onOpenChange}
            onSubmit={() => {
                if (canSave) {
                    onSave();
                }
            }}
            open={open}
            title="MerchBase"
            titleSuffix="Integration"
        >
            <IntegrationField label="Base URL">
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
            </IntegrationField>

            <IntegrationFieldRow>
                <IntegrationField label="Default account">
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
                </IntegrationField>

                <IntegrationField label="Default marketplace">
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
                </IntegrationField>
            </IntegrationFieldRow>

            <IntegrationField label="API key">
                <SecretInput
                    ariaLabel="MerchBase API key"
                    disabled={isSaving}
                    name="merchbase-api-key"
                    onChange={(value) =>
                        onDraftChange((current) => ({ ...current, apiKey: value }))
                    }
                    onRevealToggle={() => setApiKeyRevealed((revealed) => !revealed)}
                    placeholder={settings.apiKeyConfigured ? '••••••••••••••••' : 'Enter API key'}
                    revealed={apiKeyRevealed}
                    value={draft.apiKey}
                />
            </IntegrationField>

            {settings.skillConflict ? (
                <IntegrationNotice title="Skill conflict">
                    Existing skill at{' '}
                    <span className="font-mono">{settings.skillConflict.skillPath}</span>. Enabling
                    MerchBase will replace it after confirmation.
                </IntegrationNotice>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}
        </IntegrationDialog>
    );
}
