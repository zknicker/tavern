import { Calendar03Icon, PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import { googlePluginManifest } from '@tavern/api/plugins/google';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
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

export type GoogleSettings = NonNullable<GoogleSettingsOutput>;

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
    const enableLockReason = draft.enabled ? null : getGoogleEnableLockReason(settings, draft);

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
                    aria-label={
                        enableLockReason
                            ? 'Google needs setup before it can be enabled'
                            : `${draft.enabled ? 'Disable' : 'Enable'} Google`
                    }
                    checked={draft.enabled}
                    disabled={isSaving || enableLockReason !== null}
                    locked={enableLockReason !== null}
                    lockTooltip={enableLockReason}
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
        <PluginSectionStack>
            <PluginSection
                description="Choose which Google services Grotto may expose to granted agents."
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
                <GoogleConnectionNotice
                    error={error}
                    oauthStatus={oauthStatus}
                    settings={settings}
                />
            </PluginSection>
        </PluginSectionStack>
    );
}

function GoogleConnectionNotice({
    error,
    oauthStatus,
    settings,
}: {
    error?: string | null;
    oauthStatus?: string | null;
    settings: GoogleSettings;
}) {
    return (
        <div className="grid gap-2">
            <PluginNotice title={settings.connected ? 'Connected' : 'Not connected'}>
                {settings.connected
                    ? (settings.connectedAccountEmail ?? 'Google account connected.')
                    : 'Connect Google before enabling the Plugin or using Calendar.'}
                {oauthStatus ? <span className="block">{oauthStatus}</span> : null}
            </PluginNotice>
            {error ? (
                <PluginNotice title="Google setup failed" variant="error">
                    {error}
                </PluginNotice>
            ) : null}
        </div>
    );
}

export function getGoogleEnableLockReason(settings: GoogleSettings, draft: GoogleSettingsDraft) {
    if (!settings.connected) {
        return 'Connect Google before enabling the Plugin.';
    }
    if (draft.calendarEnabled && settings.missingCalendarScopes.length > 0) {
        return 'Reconnect Google to authorize Calendar before enabling the Plugin.';
    }
    return null;
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
