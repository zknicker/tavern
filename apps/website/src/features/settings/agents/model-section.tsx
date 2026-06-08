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
import type { AgentModelDraft, HermesHarness, ThinkingLevelValue } from './types.ts';

type Model = ModelListOutput['models'][number];
type ModelChoice = ReturnType<typeof listModelChoices>[number];

const inheritThinkingValue = '__inherit__';

export function AgentModelSection({
    disabled,
    modelOptions,
    onChange,
    syncError,
    value,
}: {
    disabled: boolean;
    modelOptions: Model[];
    onChange: (value: AgentModelDraft | null) => void;
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
                                              harness: inferHarness(nextChoice.model.provider),
                                              modelRef: nextChoice.model.ref,
                                              thinkingDefault: normalizeThinkingDefaultForChoice(
                                                  value?.thinkingDefault ?? null,
                                                  nextChoice
                                              ),
                                          }
                                        : null
                                );
                            }}
                            value={value?.modelRef ?? undefined}
                        >
                            <SelectTrigger className="h-auto min-h-12 py-2">
                                <SelectValue
                                    className="min-w-0 flex-1 whitespace-normal"
                                    placeholder="Choose model"
                                >
                                    {selectedChoice ? (
                                        <ModelChoiceLabel choice={selectedChoice} />
                                    ) : undefined}
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
                                                  harness: inferHarness(
                                                      selectedChoice.model.provider
                                                  ),
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
                            <SelectTrigger className="h-auto min-h-12 py-2">
                                <SelectValue
                                    className="min-w-0 flex-1 whitespace-normal"
                                    placeholder="Choose thinking"
                                >
                                    <ThinkingSelectLabel
                                        description={
                                            getThinkingOption(value?.thinkingDefault ?? null)
                                                ?.description ??
                                            "Use the selected model's Hermes default."
                                        }
                                        label={
                                            getThinkingOption(value?.thinkingDefault ?? null)
                                                ?.label ?? 'Inherit'
                                        }
                                    />
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={inheritThinkingValue}>
                                    <ThinkingSelectLabel
                                        description="Use the selected model's Hermes default."
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
    if (!choice) {
        return listThinkingOptions(['off', 'minimal', 'low', 'medium', 'high']);
    }

    return listThinkingOptions([
        'off',
        'minimal',
        'low',
        'medium',
        'high',
        ...listExtraThinkingLevels(choice),
    ]);
}

function normalizeThinkingDefaultForChoice(
    value: ThinkingLevelValue | null,
    choice: ModelChoice | null
) {
    if (!value) {
        return null;
    }

    return listThinkingOptionsForModelChoice(choice).some((option) => option.value === value)
        ? value
        : null;
}

function listThinkingOptions(values: ThinkingLevelValue[]) {
    const allowed = new Set(values);
    return thinkingOptions.filter((option) => allowed.has(option.value));
}

function listExtraThinkingLevels(choice: ModelChoice): ThinkingLevelValue[] {
    const model = choice.model.modelId.toLowerCase();
    const provider = choice.model.provider.toLowerCase();

    if (provider === 'openai-codex') {
        return supportsOpenAiXHigh(model, inferHarness(choice.model.provider)) ? ['xhigh'] : [];
    }

    if (provider === 'anthropic') {
        if (/(?:^|[/.:])claude-opus-4[.-]7(?:$|[-.:/])/u.test(model)) {
            return ['xhigh', 'adaptive', 'max'];
        }

        if (/claude-(?:opus|sonnet)-4(?:\.|-)6(?:$|[-.])/u.test(model)) {
            return ['adaptive'];
        }
    }

    if (provider === 'openrouter' && /(?:^|[/.:])deepseek[-_/]v?4(?:$|[-.:/])/u.test(model)) {
        return ['xhigh'];
    }

    return [];
}

function supportsOpenAiXHigh(model: string, harness: HermesHarness) {
    const codexModels = ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-pro'];
    const apiModels = [...codexModels, 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.2'];
    const supportedModels = harness === 'codex' ? codexModels : apiModels;

    return supportedModels.some((supportedModel) => model === supportedModel);
}

function inferHarness(provider: string): HermesHarness {
    return provider.toLowerCase() === 'openai-codex' ? 'codex' : 'pi';
}
