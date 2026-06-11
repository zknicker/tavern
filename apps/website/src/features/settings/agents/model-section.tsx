import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import {
    getThinkingOption,
    type ThinkingOption,
    thinkingOptions,
} from '../../../components/ui/thinking-shared.ts';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import { type FallbackModelEntry, FallbackModelsEditor } from './fallback-models-editor.tsx';
import {
    type SubagentEffortValue,
    type SubagentModelEntry,
    SubagentRows,
} from './subagent-rows.tsx';
import type { AgentModelDraft, ThinkingLevelValue } from './types.ts';

type Model = ModelListOutput['models'][number];
type ModelChoice = ReturnType<typeof listModelChoices>[number];

const inheritThinkingValue = '__inherit__';

export function AgentModelSection({
    disabled,
    fallbackModels,
    fallbacksDisabled,
    modelOptions,
    onChange,
    onFallbacksChange,
    onSubagentEffortChange,
    onSubagentModelChange,
    subagentEffort,
    subagentModel,
    syncError,
    value,
}: {
    disabled: boolean;
    fallbackModels: FallbackModelEntry[];
    fallbacksDisabled: boolean;
    modelOptions: Model[];
    onChange: (value: AgentModelDraft | null) => void;
    onFallbacksChange: (next: FallbackModelEntry[]) => void;
    onSubagentEffortChange: (next: SubagentEffortValue | null) => void;
    onSubagentModelChange: (next: SubagentModelEntry | null) => void;
    subagentEffort: SubagentEffortValue | null;
    subagentModel: SubagentModelEntry | null;
    syncError: string | null;
    value: AgentModelDraft | null;
}) {
    const choices = listModelChoices(modelOptions);
    const selectedChoice = choices.find((choice) => choice.model.ref === value?.modelRef) ?? null;
    const selectedThinkingOptions = listThinkingOptionsForModelChoice(selectedChoice);
    const isDisabled = disabled;

    return (
        <section>
            <BadgeDivider className="pb-4">Model</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow title="Model">
                        <Select
                            disabled={isDisabled}
                            onValueChange={(modelRef) => {
                                const nextChoice = choices.find(
                                    (choice) => choice.model.ref === modelRef
                                );

                                onChange(
                                    nextChoice
                                        ? {
                                              modelRef: nextChoice.model.ref,
                                              thinkingDefault: value?.thinkingDefault ?? null,
                                          }
                                        : null
                                );
                            }}
                            value={value?.modelRef ?? undefined}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose model">
                                    {selectedChoice ? selectedChoice.model.name : undefined}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {choices.map((choice) => (
                                    <SelectItem key={choice.model.ref} value={choice.model.ref}>
                                        <ModelChoiceLabel choice={choice} />
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {syncError ? (
                            <Alert variant="error">
                                <Icon icon={AlertCircleIcon} />
                                <AlertDescription>{syncError}</AlertDescription>
                            </Alert>
                        ) : null}
                    </SettingsRow>

                    <Separator />

                    <SettingsRow title="Thinking">
                        <Select
                            disabled={isDisabled || !selectedChoice}
                            onValueChange={(nextValue) =>
                                onChange(
                                    selectedChoice
                                        ? {
                                              ...(value ?? {
                                                  modelRef: selectedChoice.model.ref,
                                              }),
                                              thinkingDefault:
                                                  nextValue === inheritThinkingValue
                                                      ? null
                                                      : (nextValue as ThinkingLevelValue),
                                          }
                                        : null
                                )
                            }
                            value={value?.thinkingDefault ?? inheritThinkingValue}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose thinking">
                                    {getThinkingOption(value?.thinkingDefault ?? null)?.label ??
                                        'Inherit'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={inheritThinkingValue}>
                                    <ThinkingSelectLabel
                                        description="Use the selected model's default."
                                        label="Inherit"
                                    />
                                </SelectItem>
                                {selectedThinkingOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        <ThinkingSelectLabel
                                            description={option.description}
                                            label={option.label}
                                        />
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>

                    <Separator />

                    <SettingsRow
                        description="Tried in order when the primary model fails."
                        title="Fallback models"
                    >
                        <FallbackModelsEditor
                            disabled={fallbacksDisabled}
                            fallbackModels={fallbackModels}
                            modelOptions={modelOptions}
                            onChange={onFallbacksChange}
                            primaryModelRef={value?.modelRef ?? null}
                        />
                    </SettingsRow>

                    <Separator />

                    <SubagentRows
                        disabled={fallbacksDisabled}
                        modelOptions={modelOptions}
                        onSubagentEffortChange={onSubagentEffortChange}
                        onSubagentModelChange={onSubagentModelChange}
                        subagentEffort={subagentEffort}
                        subagentModel={subagentModel}
                    />
                </Card>
            </CardFrame>
        </section>
    );
}

function ModelChoiceLabel({ choice }: { choice: ModelChoice }) {
    return (
        <span className="block min-w-0">
            <span className="block truncate">{choice.model.name}</span>
            <span className="block truncate text-muted-foreground text-xs">
                {choice.model.provider}
            </span>
        </span>
    );
}

function ThinkingSelectLabel({ description, label }: { description: string; label: string }) {
    return (
        <span className="block min-w-0">
            <span className="block truncate">{label}</span>
            <span className="block truncate text-muted-foreground text-xs">{description}</span>
        </span>
    );
}

function listModelChoices(models: Model[]) {
    return models
        .map((model) => ({ model }))
        .sort(
            (left, right) =>
                left.model.name.localeCompare(right.model.name) ||
                left.model.provider.localeCompare(right.model.provider)
        );
}

export function selectModelChoice(models: Model[], current: AgentModelDraft | null) {
    const choices = listModelChoices(models);

    if (!current?.modelRef) {
        return choices[0] ?? null;
    }

    return choices.find((choice) => choice.model.ref === current.modelRef) ?? choices[0] ?? null;
}

export function listThinkingOptionsForModelChoice(choice: ModelChoice | null): ThinkingOption[] {
    return choice ? thinkingOptions : [];
}
