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
import type { ModelListOutput } from '../../../lib/trpc.tsx';

export interface CompressionSettings {
    enabled: boolean;
    protectLastMessages: number;
    thresholdPercent: number;
}

export interface WebExtractSummarizerSettings {
    baseUrl?: string;
    model: string;
    provider: string;
    timeoutSeconds: number;
}

type Model = ModelListOutput['models'][number];
interface WebExtractSummarizerChoice {
    description: string;
    model: string;
    name: string;
    provider: string;
    ref: string;
}

const systemTimezoneValue = '__system__';
const defaultCompressionValue = '__default__';
const customCompressionValue = '__custom__';
const autoWebExtractSummarizerValue = '__auto__';
const defaultWebExtractSummarizerTimeoutSeconds = 360;

const customCompressionSeed: CompressionSettings = {
    enabled: true,
    protectLastMessages: 20,
    thresholdPercent: 80,
};

const recommendedWebExtractSummarizerChoice: WebExtractSummarizerChoice = {
    description: 'OpenRouter',
    model: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'openrouter',
    ref: 'openrouter/google/gemini-3-flash-preview',
};

export function AgentBehaviorSection({
    compression,
    disabled,
    modelOptions,
    onCompressionChange,
    onTimezoneChange,
    onWebExtractSummarizerChange,
    timezone,
    webExtractSummarizer,
}: {
    compression: CompressionSettings | null;
    disabled: boolean;
    modelOptions: Model[];
    onCompressionChange: (next: CompressionSettings | null) => void;
    onTimezoneChange: (timezone: null | string) => void;
    onWebExtractSummarizerChange: (next: WebExtractSummarizerSettings | null) => void;
    timezone: null | string;
    webExtractSummarizer: WebExtractSummarizerSettings | null;
}) {
    const timezones = Intl.supportedValuesOf('timeZone');
    const summarizerChoices = listWebExtractSummarizerChoices({
        current: webExtractSummarizer,
        models: modelOptions,
    });
    const selectedSummarizerRef = webExtractSummarizer
        ? formatWebExtractSummarizerRef(webExtractSummarizer)
        : autoWebExtractSummarizerValue;
    const selectedSummarizerChoice =
        summarizerChoices.find((choice) => choice.ref === selectedSummarizerRef) ?? null;

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
                        description="Model used to summarize long web pages."
                        title="Web page summarizer"
                    >
                        <Select
                            disabled={disabled}
                            onValueChange={(value) => {
                                if (value === autoWebExtractSummarizerValue) {
                                    onWebExtractSummarizerChange(null);
                                    return;
                                }

                                const choice = summarizerChoices.find(
                                    (candidate) => candidate.ref === value
                                );
                                if (!choice) {
                                    return;
                                }

                                onWebExtractSummarizerChange({
                                    model: choice.model,
                                    provider: choice.provider,
                                    timeoutSeconds:
                                        webExtractSummarizer?.timeoutSeconds ??
                                        defaultWebExtractSummarizerTimeoutSeconds,
                                });
                            }}
                            value={selectedSummarizerRef}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose summarizer">
                                    {selectedSummarizerChoice
                                        ? selectedSummarizerChoice.name
                                        : 'Auto (main model)'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={autoWebExtractSummarizerValue}>
                                    <WebExtractSummarizerLabel
                                        description="Uses the main chat model"
                                        name="Auto"
                                    />
                                </SelectItem>
                                {summarizerChoices.map((choice) => (
                                    <SelectItem key={choice.ref} value={choice.ref}>
                                        <WebExtractSummarizerLabel
                                            description={choice.description}
                                            name={choice.name}
                                        />
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>

                    <Separator />

                    <SettingsRow
                        description="How older chat history gets summarized."
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
                                description="Start compressing past this much context."
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

export function listWebExtractSummarizerChoices({
    current,
    models,
}: {
    current: WebExtractSummarizerSettings | null;
    models: Model[];
}): WebExtractSummarizerChoice[] {
    const choicesByRef = new Map<string, WebExtractSummarizerChoice>();

    for (const model of models) {
        choicesByRef.set(model.ref, {
            description: model.provider,
            model: model.modelId,
            name: model.name,
            provider: model.provider,
            ref: model.ref,
        });
    }

    choicesByRef.set(
        recommendedWebExtractSummarizerChoice.ref,
        recommendedWebExtractSummarizerChoice
    );

    if (current) {
        const ref = formatWebExtractSummarizerRef(current);
        if (!choicesByRef.has(ref)) {
            choicesByRef.set(ref, {
                description: current.provider,
                model: current.model,
                name: `${current.provider}/${current.model}`,
                provider: current.provider,
                ref,
            });
        }
    }

    return [...choicesByRef.values()].sort((left, right) => {
        if (left.ref === recommendedWebExtractSummarizerChoice.ref) {
            return -1;
        }
        if (right.ref === recommendedWebExtractSummarizerChoice.ref) {
            return 1;
        }
        return left.name.localeCompare(right.name) || left.provider.localeCompare(right.provider);
    });
}

export function formatWebExtractSummarizerRef(input: { model: string; provider: string }) {
    return `${input.provider}/${input.model}`;
}

function WebExtractSummarizerLabel({ description, name }: { description: string; name: string }) {
    return (
        <span className="block min-w-0">
            <span className="block truncate">{name}</span>
            <span className="block truncate text-muted-foreground text-xs">{description}</span>
        </span>
    );
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
