import { SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import { Badge } from '../../../components/ui/badge.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Progress } from '../../../components/ui/progress.tsx';
import { SettingsRow, SettingsValue } from '../../../components/ui/settings-row.tsx';
import {
    type TavernUpdateStatus,
    useTavernUpdate,
} from '../../../hooks/desktop/use-tavern-update.ts';

export function UpdatesSettings() {
    const { checkForUpdate, status, updateAndRestart } = useTavernUpdate();
    const copy = getUpdateCopy(status);
    const canCheck = status.phase !== 'checking' && status.phase !== 'downloading-app';
    const canInstall = status.phase === 'available' || status.phase === 'ready';

    return (
        <div>
            <BadgeDivider className="pb-5">Tavern Updates</BadgeDivider>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                <SettingsRow
                    description="Stage Runtime first, download the app update, then restart when ready."
                    title="Tavern"
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
                        </div>
                        <SettingsValue className="min-h-0 justify-start text-left md:justify-start md:text-left">
                            {copy}
                        </SettingsValue>
                        {status.phase === 'downloading-app' ? (
                            <Progress value={status.progress * 100} />
                        ) : null}
                    </div>
                </SettingsRow>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: TavernUpdateStatus }) {
    const label = getStatusLabel(status);
    const variant =
        status.phase === 'available'
            ? 'info'
            : status.phase === 'failed'
              ? 'warning'
              : status.phase === 'idle'
                ? 'success'
                : 'secondary';

    return (
        <Badge className="max-w-full truncate" variant={variant}>
            {label}
        </Badge>
    );
}

function getStatusLabel(status: TavernUpdateStatus) {
    switch (status.phase) {
        case 'available':
            return `v${status.version} available`;
        case 'checking':
            return 'Checking';
        case 'idle':
            return 'Up to date';
        case 'staging-runtime':
            return 'Staging Runtime';
        case 'downloading-app':
            return `Downloading ${Math.round(status.progress * 100)}%`;
        case 'ready':
            return `v${status.version} ready`;
        case 'failed':
            return 'Update failed';
        case 'restarting-runtime':
            return 'Restarting Runtime';
        case 'restarting-app':
            return 'Restarting Tavern';
        case 'unsupported':
            return 'Mac app only';
        default:
            return 'Ready';
    }
}

function getUpdateCopy(status: TavernUpdateStatus) {
    switch (status.phase) {
        case 'available':
            return status.detail;
        case 'checking':
        case 'idle':
        case 'staging-runtime':
        case 'downloading-app':
        case 'ready':
        case 'failed':
        case 'restarting-runtime':
        case 'restarting-app':
            return status.detail;
        case 'unsupported':
            return 'Updates are available inside the packaged Mac desktop app.';
        default:
            return 'Tavern checks the release feed automatically when this page opens.';
    }
}
