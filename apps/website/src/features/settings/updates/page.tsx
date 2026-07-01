import { SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Progress } from '../../../components/ui/progress.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../../components/ui/settings-row.tsx';
import { useRuntimeConnection } from '../../../hooks/connections/use-runtime-connection.ts';
import {
    type TavernUpdateStatus,
    useTavernUpdate,
} from '../../../hooks/desktop/use-tavern-update.ts';
import { cn } from '../../../lib/utils.ts';

export function UpdatesSettings() {
    const { connection } = useRuntimeConnection();
    const { checkForUpdate, status, updateAndRestart } = useTavernUpdate();
    const [hasCheckedForUpdate, setHasCheckedForUpdate] = React.useState(false);
    const canCheck = status.phase !== 'checking' && status.phase !== 'downloading-app';
    const canInstall =
        status.phase === 'app-update-required' ||
        status.phase === 'available' ||
        status.phase === 'ready';
    const updateStatusMessage = getUpdateStatusMessage(status, hasCheckedForUpdate);

    const handleCheckForUpdate = React.useCallback(async () => {
        await checkForUpdate();
        setHasCheckedForUpdate(true);
    }, [checkForUpdate]);

    return (
        <SettingsPage>
            <SettingsPageHeader title="Updates" />
            <SettingsSection title="Tavern Updates">
                <SettingsGroup>
                    <SettingsRow
                        className="md:items-start"
                        description="The app and runtime update automatically."
                        title="Update"
                        trailingWidth="intrinsic"
                    >
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex shrink-0 items-center gap-2 md:justify-end">
                                <Button
                                    disabled={!canCheck}
                                    loading={status.phase === 'checking'}
                                    onClick={handleCheckForUpdate}
                                    variant="secondary"
                                >
                                    Check
                                </Button>
                                <Button
                                    disabled={!canInstall}
                                    loading={
                                        status.phase === 'downloading-app' ||
                                        status.phase === 'staging-runtime' ||
                                        status.phase === 'restarting-runtime' ||
                                        status.phase === 'restarting-app'
                                    }
                                    onClick={updateAndRestart}
                                >
                                    <Icon icon={SystemUpdate01Icon} />
                                    {status.phase === 'ready' ? 'Restart' : 'Update'}
                                </Button>
                            </div>
                            {status.phase === 'downloading-app' ? (
                                <Progress value={status.progress * 100} />
                            ) : null}
                            {updateStatusMessage ? (
                                <UpdateStatusMessage {...updateStatusMessage} />
                            ) : null}
                        </div>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="App version">
                        <VersionValue>{connection?.appVersion ?? 'Unknown'}</VersionValue>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Runtime version">
                        <VersionValue>
                            {connection
                                ? (connection.runtimeVersion ?? 'Unknown')
                                : 'No Runtime Connected'}
                        </VersionValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function UpdateStatusMessage({
    detail,
    tone,
}: {
    detail: string;
    tone: 'error' | 'neutral' | 'success';
}) {
    return (
        <SettingsValue
            className={cn(
                'min-h-0 justify-start text-left font-medium md:justify-start md:text-left',
                tone === 'success' && 'text-success-foreground',
                tone === 'error' && 'text-error-foreground',
                tone === 'neutral' && 'text-muted-foreground'
            )}
        >
            {detail}
        </SettingsValue>
    );
}

function VersionValue({ children }: { children: React.ReactNode }) {
    return (
        <SettingsValue className="font-mono text-foreground tabular-nums">{children}</SettingsValue>
    );
}

export function getUpdateStatusMessage(
    status: TavernUpdateStatus,
    hasCheckedForUpdate: boolean
): null | {
    detail: string;
    tone: 'error' | 'neutral' | 'success';
} {
    switch (status.phase) {
        case 'idle':
            return hasCheckedForUpdate ? { detail: 'Up to date', tone: 'success' } : null;
        case 'available':
        case 'app-update-required':
        case 'ready':
            return { detail: status.detail, tone: 'error' };
        case 'failed':
            return { detail: status.detail, tone: 'error' };
        case 'checking':
        case 'runtime-disconnected':
        case 'unsupported':
            return hasCheckedForUpdate ? { detail: status.detail, tone: 'neutral' } : null;
        case 'staging-runtime':
            return { detail: status.detail, tone: 'neutral' };
        case 'downloading-app':
        case 'restarting-app':
        case 'restarting-runtime':
            return null;
    }
}
