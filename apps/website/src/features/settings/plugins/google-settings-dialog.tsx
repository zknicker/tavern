import { Calendar03Icon, PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import { googlePluginManifest } from '@tavern/api/plugins/google';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { FieldError } from '../../../components/ui/primitives/field.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import type { GoogleSettingsOutput } from '../../../lib/trpc.tsx';
import type { GoogleSettingsDraft } from './google-settings-model.ts';
import { PluginConfigFields } from './plugin-config-fields.tsx';
import { PluginDialog, PluginLockSwitch, PluginNotice } from './plugin-dialog.tsx';
import {
    PluginSection,
    PluginSectionStack,
    type PluginServiceDescriptor,
    PluginServiceList,
    PluginServiceRow,
} from './plugin-service-fields.tsx';

type GoogleSettings = NonNullable<GoogleSettingsOutput>;

export function GoogleSettingsDialog({
    canSave,
    draft,
    error,
    isSaving,
    oauthStatus,
    onConnect,
    onDisconnect,
    onDraftChange,
    onOpenChange,
    onSave,
    open,
    settings,
}: {
    canSave: boolean;
    draft: GoogleSettingsDraft;
    error?: string | null;
    isSaving: boolean;
    oauthStatus?: string | null;
    onConnect: () => Promise<unknown>;
    onDisconnect: () => Promise<unknown> | undefined;
    onDraftChange: Dispatch<SetStateAction<GoogleSettingsDraft>>;
    onOpenChange: (open: boolean) => void;
    onSave: () => Promise<unknown>;
    open: boolean;
    settings: GoogleSettings;
}) {
    return (
        <PluginDialog
            description={googlePluginManifest.description}
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
                    aria-label={`${draft.enabled ? 'Disable' : 'Enable'} Google`}
                    checked={draft.enabled}
                    disabled={isSaving}
                    locked={false}
                    onCheckedChange={(enabled) =>
                        onDraftChange((current) => ({ ...current, enabled }))
                    }
                />
            }
            icon={PlugIcon}
            onOpenChange={onOpenChange}
            onSubmit={() => {
                if (canSave) {
                    void onSave().catch(() => undefined);
                }
            }}
            open={open}
            title="Google"
            titleSuffix="Plugin"
        >
            <GoogleSettingsDialogBody
                draft={draft}
                error={error}
                isSaving={isSaving}
                oauthStatus={oauthStatus}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                onDraftChange={onDraftChange}
                settings={settings}
            />
        </PluginDialog>
    );
}

export function GoogleSettingsDialogBody({
    draft,
    error,
    isSaving,
    oauthStatus,
    onConnect,
    onDisconnect,
    onDraftChange,
    settings,
}: {
    draft: GoogleSettingsDraft;
    error?: string | null;
    isSaving: boolean;
    oauthStatus?: string | null;
    onConnect: () => Promise<unknown>;
    onDisconnect: () => Promise<unknown> | undefined;
    onDraftChange: Dispatch<SetStateAction<GoogleSettingsDraft>>;
    settings: GoogleSettings;
}) {
    return (
        <>
            <PluginSectionStack>
                <PluginSection
                    description="Choose which Google services Tavern may expose to granted agents."
                    title="Services"
                >
                    <PluginServiceList>
                        {googleServices.map((service) => {
                            const enabled = service.read(draft);
                            return (
                                <PluginServiceRow
                                    control={
                                        <Switch
                                            aria-label={`${enabled ? 'Disable' : 'Enable'} ${service.name}`}
                                            checked={enabled}
                                            disabled={isSaving}
                                            onCheckedChange={(nextEnabled) =>
                                                onDraftChange((current) =>
                                                    service.write(current, nextEnabled)
                                                )
                                            }
                                        />
                                    }
                                    description={service.description}
                                    icon={service.icon}
                                    key={service.id}
                                    label={service.name}
                                >
                                    {enabled && service.fields?.length ? (
                                        <PluginConfigFields
                                            disabled={isSaving}
                                            draft={draft}
                                            fields={service.fields}
                                            onDraftChange={onDraftChange}
                                        />
                                    ) : null}
                                </PluginServiceRow>
                            );
                        })}
                    </PluginServiceList>
                </PluginSection>

                <PluginSection
                    action={
                        <>
                            <Button
                                disabled={isSaving}
                                onClick={() => {
                                    void onConnect().catch(() => undefined);
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                {settings.connected ? 'Reconnect' : 'Connect'}
                            </Button>
                            {settings.connected ? (
                                <Button
                                    disabled={isSaving}
                                    onClick={() => {
                                        void onDisconnect()?.catch(() => undefined);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    Disconnect
                                </Button>
                            ) : null}
                        </>
                    }
                    description="Authorize the Google account used by enabled services."
                    title="Connection"
                >
                    <GoogleConnectionNotice oauthStatus={oauthStatus} settings={settings} />
                </PluginSection>
            </PluginSectionStack>

            {error ? <FieldError>{error}</FieldError> : null}
        </>
    );
}

function GoogleConnectionNotice({
    oauthStatus,
    settings,
}: {
    oauthStatus?: string | null;
    settings: GoogleSettings;
}) {
    return (
        <PluginNotice title={settings.connected ? 'Connected' : 'Not connected'}>
            {settings.connected
                ? (settings.connectedAccountEmail ?? 'Google account connected.')
                : 'Connect Google before agents can use Calendar.'}
            {oauthStatus ? <span className="block">{oauthStatus}</span> : null}
        </PluginNotice>
    );
}

const googleServices: readonly PluginServiceDescriptor<GoogleSettingsDraft>[] = [
    {
        description: 'Read and create Google Calendar events.',
        icon: Calendar03Icon,
        id: 'calendar',
        name: 'Calendar',
        read: (draft) => draft.calendarEnabled,
        write: (draft, calendarEnabled) => ({ ...draft, calendarEnabled }),
    },
];
