import {
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { ModelAccessSettings } from '../connections/model-access.tsx';
import { ModelInventorySection } from './model-inventory-section.tsx';

export function ModelsSettings() {
    return (
        <SettingsPage>
            <SettingsPageHeader title="Models" />
            <ModelAccessSettings />

            <SettingsSection title="Available Models">
                <ModelInventorySection />
            </SettingsSection>
        </SettingsPage>
    );
}
