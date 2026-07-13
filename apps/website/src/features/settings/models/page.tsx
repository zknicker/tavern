import {
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { ModelAccessSettings } from '../connections/model-access.tsx';
import { BackgroundModelsSection } from './background-models-section.tsx';
import { ImageGenerationSection } from './image-generation-section.tsx';
import { ModelInventorySection } from './model-inventory-section.tsx';

export function ModelsSettings() {
    return (
        <SettingsPage>
            <SettingsPageHeader title="Models" />
            <ModelAccessSettings />

            <BackgroundModelsSection />

            <ImageGenerationSection />

            <SettingsSection title="Available Models">
                <ModelInventorySection />
            </SettingsSection>
        </SettingsPage>
    );
}
