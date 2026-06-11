import { useState } from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';

export interface CompressionSettings {
    enabled: boolean;
    protectLastMessages: number;
    thresholdPercent: number;
}

const systemTimezoneValue = '__system__';
const defaultCompressionValue = '__default__';
const customCompressionValue = '__custom__';

const customCompressionSeed: CompressionSettings = {
    enabled: true,
    protectLastMessages: 20,
    thresholdPercent: 80,
};

export function AgentBehaviorSection({
    compression,
    disabled,
    onCompressionChange,
    onTimezoneChange,
    timezone,
}: {
    compression: CompressionSettings | null;
    disabled: boolean;
    onCompressionChange: (next: CompressionSettings | null) => void;
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
                                if (!value) {
                                    return;
                                }

                                onTimezoneChange(resolveTimezoneSelection(value));
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

                    <Separator />

                    <SettingsRow
                        description="How older conversation context is summarized."
                        title="Context compression"
                    >
                        <Select
                            disabled={disabled}
                            onValueChange={(value) => {
                                if (value === defaultCompressionValue) {
                                    onCompressionChange(null);
                                    return;
                                }

                                if (!compression) {
                                    onCompressionChange(customCompressionSeed);
                                }
                            }}
                            value={compression ? customCompressionValue : defaultCompressionValue}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose compression">
                                    {compression ? 'Custom' : 'Default (recommended)'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={defaultCompressionValue}>
                                    Default (recommended)
                                </SelectItem>
                                <SelectItem value={customCompressionValue}>Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingsRow>

                    {compression ? (
                        <>
                            <Separator />

                            <SettingsRow
                                description="Start compressing at this share of the context window."
                                title="Compression threshold"
                            >
                                <CompressionNumberInput
                                    disabled={disabled}
                                    key={`threshold-${compression.thresholdPercent}`}
                                    max={95}
                                    min={10}
                                    onCommit={(thresholdPercent) =>
                                        onCompressionChange(
                                            clampCompression({ ...compression, thresholdPercent })
                                        )
                                    }
                                    suffix="%"
                                    value={compression.thresholdPercent}
                                />
                            </SettingsRow>

                            <Separator />

                            <SettingsRow
                                description="Always kept uncompressed."
                                title="Protected recent messages"
                            >
                                <CompressionNumberInput
                                    disabled={disabled}
                                    key={`protect-${compression.protectLastMessages}`}
                                    max={400}
                                    min={0}
                                    onCommit={(protectLastMessages) =>
                                        onCompressionChange(
                                            clampCompression({
                                                ...compression,
                                                protectLastMessages,
                                            })
                                        )
                                    }
                                    value={compression.protectLastMessages}
                                />
                            </SettingsRow>
                        </>
                    ) : null}
                </Card>
            </CardFrame>
        </section>
    );
}

export function resolveTimezoneSelection(value: string): null | string {
    return value === systemTimezoneValue ? null : value;
}

export function clampCompression(input: CompressionSettings): CompressionSettings {
    return {
        enabled: input.enabled,
        protectLastMessages: clampInteger(input.protectLastMessages, 0, 400),
        thresholdPercent: clampInteger(input.thresholdPercent, 10, 95),
    };
}

function clampInteger(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, Math.round(value)));
}

function CompressionNumberInput({
    disabled,
    max,
    min,
    onCommit,
    suffix,
    value,
}: {
    disabled: boolean;
    max: number;
    min: number;
    onCommit: (next: number) => void;
    suffix?: string;
    value: number;
}) {
    const [draft, setDraft] = useState(String(value));

    const commit = () => {
        const parsed = Number(draft);

        if (!Number.isFinite(parsed)) {
            setDraft(String(value));
            return;
        }

        if (parsed === value) {
            setDraft(String(value));
            return;
        }

        onCommit(parsed);
    };

    return (
        <div className="flex items-center gap-2">
            <Input
                disabled={disabled}
                max={max}
                min={min}
                onBlur={commit}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        commit();
                    }
                }}
                type="number"
                value={draft}
            />
            {suffix ? <span className="text-muted-foreground text-sm">{suffix}</span> : null}
        </div>
    );
}
