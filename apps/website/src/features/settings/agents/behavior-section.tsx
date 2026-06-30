import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';

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
        <section>
            <BadgeDivider className="pb-4">Behavior</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow
                        description="Used for schedules and time-aware answers."
                        title="Timezone"
                    >
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
                </Card>
            </CardFrame>
        </section>
    );
}

export function resolveTimezoneSelection(value: string): null | string {
    return value === systemTimezoneValue ? null : value;
}
