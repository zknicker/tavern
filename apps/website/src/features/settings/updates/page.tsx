import { SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import { Badge } from '../../../components/ui/badge.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Progress } from '../../../components/ui/progress.tsx';
import { SettingsRow, SettingsValue } from '../../../components/ui/settings-row.tsx';
import {
    type DesktopUpdateStatus,
    useDesktopUpdate,
} from '../../../hooks/desktop/use-desktop-update.ts';

export function UpdatesSettings() {
    const { checkForUpdate, status, updateAndRestart } = useDesktopUpdate();
    const copy = getUpdateCopy(status);
    const canCheck = status.phase !== 'checking' && status.phase !== 'downloading';
    const canInstall = status.phase === 'available';

    return (
        <div>
            <BadgeDivider className="pb-5">Desktop Updates</BadgeDivider>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                <SettingsRow
                    description="Check the signed release feed and restart when the update is ready."
                    title="Tavern for Mac"
                >
                    <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                            <StatusBadge status={status} />
                            <div className="flex shrink-0 items-center gap-2">
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
                                        status.phase === 'downloading' ||
                                        status.phase === 'restarting'
                                    }
                                    onClick={updateAndRestart}
                                    size="sm"
                                >
                                    <Icon icon={SystemUpdate01Icon} />
                                    Update
                                </Button>
                            </div>
                        </div>
                        <SettingsValue className="min-h-0 justify-start text-left md:justify-start md:text-left">
                            {copy}
                        </SettingsValue>
                        {status.phase === 'downloading' ? (
                            <Progress value={status.progress * 100} />
                        ) : null}
                    </div>
                </SettingsRow>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: DesktopUpdateStatus }) {
    const label = getStatusLabel(status);
    const variant =
        status.phase === 'available'
            ? 'info'
            : status.phase === 'error'
              ? 'warning'
              : status.phase === 'current'
                ? 'success'
                : 'secondary';

    return (
        <Badge className="max-w-full truncate" variant={variant}>
            {label}
        </Badge>
    );
}

function getStatusLabel(status: DesktopUpdateStatus) {
    switch (status.phase) {
        case 'available':
            return `v${status.version} available`;
        case 'checking':
            return 'Checking';
        case 'current':
            return 'Up to date';
        case 'downloading':
            return `Downloading ${Math.round(status.progress * 100)}%`;
        case 'error':
            return 'Update failed';
        case 'restarting':
            return 'Restarting';
        case 'unsupported':
            return 'Mac app only';
        default:
            return 'Ready';
    }
}

function getUpdateCopy(status: DesktopUpdateStatus) {
    switch (status.phase) {
        case 'available':
            return `Version ${status.version} is ready to download and install.`;
        case 'checking':
            return 'Looking for the latest signed Tavern release.';
        case 'current':
            return 'This copy is on the latest published release.';
        case 'downloading':
            return 'Downloading the update. Tavern will restart after installation.';
        case 'error':
            return status.message;
        case 'restarting':
            return 'The update is installed. Tavern is restarting now.';
        case 'unsupported':
            return 'Updates are available inside the packaged Mac desktop app.';
        default:
            return 'Tavern checks the release feed automatically when this page opens.';
    }
}
