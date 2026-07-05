import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useCapability } from '../../../hooks/connections/use-capability.ts';
import {
    useMemoryEnabled,
    useSaveMemoryEnabled,
} from '../../../hooks/memory/use-memory-history.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { BackgroundWorkSection } from './background-work-section.tsx';
import { MemoryHistorySection } from './memory-history-section.tsx';

export function MemoriesSettings() {
    return (
        <SettingsPage>
            <SettingsPageHeader title="Memory" />
            <MemoryWorkersBanner />
            <SettingsGroup>
                <MemoryEnabledRow />
            </SettingsGroup>
            <BackgroundWorkSection />
            <MemoryHistorySection />
        </SettingsPage>
    );
}

function MemoryWorkersBanner() {
    const workers = useCapability('memoryWorkers');
    if (workers.healthy || workers.state === 'unknown') {
        return null;
    }

    return (
        <Alert variant="warning">
            <Icon icon={AlertCircleIcon} />
            <AlertDescription>
                Memory can’t update right now — it needs a direct model connection. Add an OpenAI or
                OpenRouter key, or pick background models, in{' '}
                <Link className="underline" to={appRoutes.settingsModels}>
                    Models settings
                </Link>
                . Chats work normally; agents just won’t remember them until this is fixed.
            </AlertDescription>
        </Alert>
    );
}

function MemoryEnabledRow() {
    const settingsQuery = useMemoryEnabled();
    const saveSettings = useSaveMemoryEnabled();

    return (
        <SettingsRow
            description="Let agents remember across chats."
            error={saveSettings.error?.message ?? null}
            title="Memory"
            trailingWidth="intrinsic"
        >
            <Switch
                aria-label="Memory enabled"
                checked={settingsQuery.data?.enabled ?? true}
                disabled={settingsQuery.isPending || saveSettings.isPending}
                onCheckedChange={(enabled) => saveSettings.mutate({ enabled })}
            />
        </SettingsRow>
    );
}
