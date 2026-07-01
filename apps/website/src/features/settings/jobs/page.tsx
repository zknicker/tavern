import { SettingsPage, SettingsPageHeader } from '../../../components/ui/settings-row.tsx';
import { Jobs } from '../../jobs/jobs.tsx';

export function JobsSettings() {
    return (
        <SettingsPage>
            <SettingsPageHeader title="Jobs" />
            <Jobs />
        </SettingsPage>
    );
}
