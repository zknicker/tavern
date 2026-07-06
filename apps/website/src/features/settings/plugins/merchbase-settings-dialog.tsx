import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import { merchbasePluginManifest } from '@tavern/api/plugins/merchbase';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { FieldError } from '../../../components/ui/primitives/field.tsx';
import type { MerchbaseSettingsOutput } from '../../../lib/trpc.tsx';
import { merchbaseEnvironmentLockTooltip } from './merchbase-settings-copy.ts';
import type { MerchbaseSettingsDraft } from './merchbase-settings-model.ts';
import {
    type PluginConfigField,
    PluginConfigFieldRow,
    PluginConfigFields,
} from './plugin-config-fields.tsx';
import { PluginDialog, PluginLockSwitch, PluginNotice } from './plugin-dialog.tsx';
import {
    PluginSection,
    PluginSectionStack,
    PluginServiceList,
    PluginServiceRow,
} from './plugin-service-fields.tsx';

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
    setupError,
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
    setupError?: string | null;
    settings: MerchbaseSettings;
}) {
    const environmentControlled = settings.enablementSource === 'environment';
    const merchbaseFields = createMerchbaseFields({ settings, setupError });

    return (
        <PluginDialog
            description={merchbasePluginManifest.description}
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
                <PluginLockSwitch
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
            titleSuffix="Plugin"
        >
            <PluginSectionStack>
                <PluginSection
                    description="MerchBase exposes one read-only service to granted agents."
                    title="Services"
                >
                    <PluginServiceList>
                        <PluginServiceRow
                            control={
                                <span className="text-muted-foreground text-sm">Included</span>
                            }
                            description="Read sales, products, catalog, and design data."
                            icon={PlugIcon}
                            label="MerchBase"
                        />
                    </PluginServiceList>
                </PluginSection>

                <PluginSection
                    description="Configure the MerchBase account and API key used by this Plugin."
                    title="Connection"
                >
                    <PluginConfigFields
                        disabled={isSaving}
                        draft={draft}
                        fields={[merchbaseFields.baseUrl]}
                        onDraftChange={onDraftChange}
                    />

                    <PluginConfigFieldRow
                        disabled={isSaving}
                        draft={draft}
                        fields={[
                            merchbaseFields.defaultAccount,
                            merchbaseFields.defaultMarketplace,
                        ]}
                        onDraftChange={onDraftChange}
                    />

                    <PluginConfigFields
                        disabled={isSaving}
                        draft={draft}
                        fields={[merchbaseFields.apiKey]}
                        onDraftChange={onDraftChange}
                    />

                    {settings.skillConflict ? (
                        <PluginNotice title="Skill conflict">
                            Existing skill at{' '}
                            <span className="font-mono">{settings.skillConflict.skillPath}</span>.
                            Enabling MerchBase will replace it after confirmation.
                        </PluginNotice>
                    ) : null}
                </PluginSection>
            </PluginSectionStack>

            {error ? <FieldError>{error}</FieldError> : null}
        </PluginDialog>
    );
}

function createMerchbaseFields({
    settings,
    setupError,
}: {
    settings: MerchbaseSettings;
    setupError?: string | null;
}) {
    return {
        apiKey: {
            ariaLabel: 'MerchBase API key',
            description: settings.apiKeyConfigured
                ? 'Clear to remove the current key.'
                : 'Required before enabling MerchBase.',
            error: setupError,
            id: 'merchbase-api-key',
            kind: 'secret',
            label: 'API key',
            placeholder: settings.apiKeyConfigured ? '••••••••••••••••' : 'Enter API key',
            read: (draft) => draft.apiKey,
            write: (draft, apiKey) => ({ ...draft, apiKey }),
        },
        baseUrl: {
            ariaLabel: 'MerchBase base URL',
            id: 'merchbase-base-url',
            kind: 'text',
            label: 'Base URL',
            monospace: true,
            read: (draft) => draft.baseUrl,
            write: (draft, baseUrl) => ({ ...draft, baseUrl }),
        },
        defaultAccount: {
            ariaLabel: 'MerchBase default account',
            id: 'merchbase-default-account',
            kind: 'text',
            label: 'Default account',
            placeholder: 'Use MerchBase default',
            read: (draft) => draft.defaultAccount,
            write: (draft, defaultAccount) => ({ ...draft, defaultAccount }),
        },
        defaultMarketplace: {
            ariaLabel: 'MerchBase default marketplace',
            id: 'merchbase-default-marketplace',
            kind: 'text',
            label: 'Default marketplace',
            placeholder: 'Use MerchBase default',
            read: (draft) => draft.defaultMarketplace,
            write: (draft, defaultMarketplace) => ({ ...draft, defaultMarketplace }),
        },
    } satisfies Record<string, PluginConfigField<MerchbaseSettingsDraft>>;
}
