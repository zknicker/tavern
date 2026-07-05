import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { useTimezoneSettings } from '../../../hooks/timezone/use-timezone-settings.ts';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';

const systemTimezoneValue = '__system__';

export function TimezoneSection() {
    const { isLoading, save, settings } = useTimezoneSettings();
    const timezones = Intl.supportedValuesOf('timeZone');
    const systemLabel = settings.resolvedTimezone
        ? `System default (${settings.resolvedTimezone})`
        : 'System default';

    return (
        <SettingsSection title="Timezone">
            <SettingsGroup>
                <SettingsRow
                    description="Home timezone for schedules, memory, and time-aware answers."
                    title="Timezone"
                >
                    <Select
                        disabled={isLoading}
                        onValueChange={(value) => {
                            if (value) {
                                void withSaveErrorToast(() =>
                                    save({ timezone: resolveTimezoneSelection(value) })
                                ).catch(() => undefined);
                            }
                        }}
                        value={settings.timezone ?? systemTimezoneValue}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Choose timezone">
                                {settings.timezone ?? systemLabel}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={systemTimezoneValue}>{systemLabel}</SelectItem>
                            {timezones.map((zone) => (
                                <SelectItem key={zone} value={zone}>
                                    {zone}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}

export function resolveTimezoneSelection(value: string): null | string {
    return value === systemTimezoneValue ? null : value;
}
