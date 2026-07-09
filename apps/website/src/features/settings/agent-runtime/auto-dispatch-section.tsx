import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useCapability } from '../../../hooks/connections/use-capability.ts';
import { useAutoDispatchSettings } from '../../../hooks/tasks/use-auto-dispatch-settings.ts';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';

const concurrencyOptions = [1, 2, 3, 4, 5];

export function AutoDispatchSection() {
    const capability = useCapability('autoDispatch');
    const { isLoading, save, settings } = useAutoDispatchSettings();

    if (!capability.healthy) {
        return null;
    }

    return (
        <SettingsSection title="Auto-dispatch">
            <SettingsGroup>
                <SettingsRow
                    description="Automatically dispatch queued tasks to their agents."
                    title="Auto-dispatch tasks"
                >
                    <div className="flex justify-start md:justify-end">
                        <Switch
                            aria-label="Auto-dispatch tasks"
                            checked={settings.autoDispatchEnabled}
                            disabled={isLoading}
                            onCheckedChange={(enabled) => {
                                void withSaveErrorToast(() =>
                                    save({ autoDispatchEnabled: enabled })
                                ).catch(() => undefined);
                            }}
                        />
                    </div>
                </SettingsRow>
                <Separator />
                <SettingsRow
                    description="How many auto-dispatched tasks may run at once."
                    title="Concurrent tasks"
                >
                    <Select
                        disabled={isLoading || !settings.autoDispatchEnabled}
                        onValueChange={(value) => {
                            const concurrency = Number.parseInt(value ?? '', 10);

                            if (Number.isFinite(concurrency)) {
                                void withSaveErrorToast(() =>
                                    save({ autoDispatchConcurrency: concurrency })
                                ).catch(() => undefined);
                            }
                        }}
                        value={String(settings.autoDispatchConcurrency)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {concurrencyOptions.map((option) => (
                                <SelectItem key={option} value={String(option)}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}
