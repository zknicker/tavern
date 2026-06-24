import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { useRuntimeCapabilityEvents } from '../../../hooks/connections/use-runtime-events.ts';
import {
    useMerchbaseSettings,
    useSaveMerchbaseSettings,
} from '../../../hooks/integrations/use-merchbase-settings.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export { MerchbaseSettingsCard } from './merchbase-settings-card.tsx';

export function IntegrationsSettingsPage() {
    useRuntimeCapabilityEvents();
    const settingsQuery = useMerchbaseSettings();
    const saveSettings = useSaveMerchbaseSettings();

    return (
        <section>
            <BadgeDivider className="pb-4" subtext="External services Tavern can use directly.">
                Integrations
            </BadgeDivider>
            <MerchbaseSettingsCard
                error={settingsQuery.error?.message ?? saveSettings.error?.message ?? null}
                isLoading={settingsQuery.isPending}
                isSaving={saveSettings.isPending}
                onSave={(input) =>
                    withSavingToast(() => saveSettings.mutateAsync(input)).catch(() => undefined)
                }
                settings={settingsQuery.data ?? null}
            />
        </section>
    );
}
