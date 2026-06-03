import { SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import type React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Progress } from '../../../components/ui/progress.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../../components/ui/settings-row.tsx';
import { useRuntimeConnection } from '../../../hooks/connections/use-runtime-connection.ts';
import { useTavernUpdate } from '../../../hooks/desktop/use-tavern-update.ts';

export function UpdatesSettings() {
    const { connection } = useRuntimeConnection();
    const { checkForUpdate, status, updateAndRestart } = useTavernUpdate();
    const canCheck = status.phase !== 'checking' && status.phase !== 'downloading-app';
    const canInstall =
        status.phase === 'app-update-required' ||
        status.phase === 'available' ||
        status.phase === 'ready';

    return (
        <div>
            <BadgeDivider className="pb-5">Tavern Updates</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow
                        className="md:items-start"
                        description="Tavern will update both your app and the connected runtime automatically."
                        title="Update"
                    >
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex shrink-0 items-center gap-2 md:justify-end">
                                <Button
                                    disabled={!canCheck}
                                    loading={status.phase === 'checking'}
                                    onClick={checkForUpdate}
                                    size="sm"
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
                                    size="sm"
                                >
                                    <Icon icon={SystemUpdate01Icon} />
                                    {status.phase === 'ready' ? 'Restart' : 'Update'}
                                </Button>
                            </div>
                            {status.phase === 'downloading-app' ? (
                                <Progress value={status.progress * 100} />
                            ) : null}
                            {status.phase === 'app-update-required' || status.phase === 'failed' ? (
                                <SettingsValue className="min-h-0 justify-start text-left md:justify-start md:text-left">
                                    {status.detail}
                                </SettingsValue>
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
                </Card>
            </CardFrame>
        </div>
    );
}

function VersionValue({ children }: { children: React.ReactNode }) {
    return (
        <SettingsValue className="font-mono text-foreground tabular-nums">{children}</SettingsValue>
    );
}
