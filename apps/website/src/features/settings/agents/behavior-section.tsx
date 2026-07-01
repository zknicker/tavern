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

const systemTimezoneValue = '__system__';

export function AgentBehaviorSection({
    disabled,
    onTimezoneChange,
    timezone,
}: {
    disabled: boolean;
    onTimezoneChange: (timezone: null | string) => void;
    timezone: null | string;
}) {
    const timezones = Intl.supportedValuesOf('timeZone');

    return (
        <SettingsSection title="Behavior">
            <SettingsGroup>
                <SettingsRow description="Schedules and time-aware answers." title="Timezone">
                    <Select
                        disabled={disabled}
                        onValueChange={(value) => {
                            if (value) {
                                onTimezoneChange(resolveTimezoneSelection(value));
                            }
                        }}
                        value={timezone ?? systemTimezoneValue}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Choose timezone">
                                {timezone ?? 'System default'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={systemTimezoneValue}>System default</SelectItem>
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
