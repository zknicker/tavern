import {
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../components/ui/settings-row.tsx';
import { UsageModules } from '../overview/usage-modules.tsx';

export function Stats() {
    return (
        <SettingsPage>
            <SettingsPageHeader title="Stats" />
            <SettingsSection title="Usage">
                <UsageModules />
            </SettingsSection>
        </SettingsPage>
    );
}
