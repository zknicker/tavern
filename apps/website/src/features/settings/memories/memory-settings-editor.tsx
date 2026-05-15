import { AlertCircleIcon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import type { ModelOptionItem } from '../../../components/ui/model-route-shared.ts';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useSaveMemorySettings } from '../../../hooks/memory/use-save-memory-settings.ts';
import { useDebouncedSave } from '../../../hooks/use-debounced-save.ts';
import type { MemorySettingsOutput } from '../../../lib/trpc.tsx';

const emptyModelValue = '__none__';

const memoryModelSlots = [
    {
        description: 'Capture memories.',
        key: 'persistenceModel',
        label: 'Persistence',
    },
    {
        description: 'Summarize recent context.',
        key: 'workingModel',
        label: 'Working',
    },
    {
        description: 'Build knowledge.',
        key: 'knowledgeModel',
        label: 'Knowledge',
    },
    {
        description: 'Maintain memory.',
        key: 'dreamModel',
        label: 'Dream',
    },
] as const;

interface MemorySettingsFormState {
    dreamModel: null | string;
    knowledgeModel: null | string;
    memoryEnabled: boolean;
    persistenceModel: null | string;
    workingModel: null | string;
}

function toFormState(settings: MemorySettingsOutput): MemorySettingsFormState {
    return {
        dreamModel: settings?.dreamModel ?? null,
        knowledgeModel: settings?.knowledgeModel ?? null,
        memoryEnabled: settings?.memoryEnabled ?? false,
        persistenceModel: settings?.persistenceModel ?? null,
        workingModel: settings?.workingModel ?? null,
    };
}

function hasCompleteModelSelection(state: MemorySettingsFormState) {
    return Boolean(
        state.dreamModel && state.knowledgeModel && state.persistenceModel && state.workingModel
    );
}

function isSameState(left: MemorySettingsFormState, right: MemorySettingsFormState) {
    return (
        left.dreamModel === right.dreamModel &&
        left.knowledgeModel === right.knowledgeModel &&
        left.memoryEnabled === right.memoryEnabled &&
        left.persistenceModel === right.persistenceModel &&
        left.workingModel === right.workingModel
    );
}

function toSaveInput(input: MemorySettingsFormState) {
    return {
        dreamModel: input.dreamModel,
        knowledgeModel: input.knowledgeModel,
        memoryEnabled: input.memoryEnabled,
        persistenceModel: input.persistenceModel,
        workingModel: input.workingModel,
    };
}

function MemoryModelSelect({
    description,
    disabled,
    label,
    onValueChange,
    options,
    value,
}: {
    description: string;
    disabled: boolean;
    label: string;
    onValueChange: (value: null | string) => void;
    options: ModelOptionItem[];
    value: null | string;
}) {
    const selectedOption = options.find((option) => option.value === value) ?? null;

    return (
        <SettingsRow description={description} title={label}>
            <Select
                disabled={disabled}
                onValueChange={(nextValue) =>
                    onValueChange(nextValue === emptyModelValue ? null : nextValue)
                }
                value={value ?? emptyModelValue}
            >
                <SelectTrigger>
                    <SelectValue placeholder={`Select a ${label.toLowerCase()} model`}>
                        {selectedOption?.label ?? 'No model selected'}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={emptyModelValue}>No model selected</SelectItem>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </SettingsRow>
    );
}

export function MemorySettingsEditor({
    canEdit,
    initialSettings,
    modelOptions,
}: {
    canEdit: boolean;
    initialSettings: MemorySettingsOutput;
    modelOptions: ModelOptionItem[];
}) {
    const initialState = React.useMemo(() => toFormState(initialSettings), [initialSettings]);
    const [formState, setFormState] = React.useState(initialState);
    const saveMutation = useSaveMemorySettings();
    const debouncedSave = useDebouncedSave((input: MemorySettingsFormState) => {
        saveMutation.mutate(toSaveInput(input));
    });
    const hasModelsSelected = hasCompleteModelSelection(formState);
    const saveError = saveMutation.error?.message ?? null;

    React.useEffect(() => {
        if (!(canEdit && !isSameState(formState, initialState))) {
            return;
        }

        debouncedSave(formState);
    }, [canEdit, debouncedSave, formState, initialState]);

    return (
        <div>
            <BadgeDivider className="pb-4">Memory Settings</BadgeDivider>
            {canEdit && modelOptions.length > 0 && hasModelsSelected && !saveError ? null : (
                <div className="space-y-3 pb-4">
                    {canEdit ? null : (
                        <Alert variant="info">
                            <Icon icon={InformationCircleIcon} />
                            <AlertDescription>
                                Tavern Runtime is not reachable, so memory settings are read-only.
                            </AlertDescription>
                        </Alert>
                    )}
                    {modelOptions.length === 0 ? (
                        <Alert variant="info">
                            <Icon icon={InformationCircleIcon} />
                            <AlertDescription>
                                Configure Tavern models first. Memory slots only accept models
                                available through connected runtimes.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    {hasModelsSelected ? null : (
                        <Alert variant="info">
                            <Icon icon={InformationCircleIcon} />
                            <AlertDescription>
                                Select a model for each slot before enabling memory.
                            </AlertDescription>
                        </Alert>
                    )}
                    {saveError ? (
                        <Alert variant="error">
                            <Icon icon={AlertCircleIcon} />
                            <AlertDescription>{saveError}</AlertDescription>
                        </Alert>
                    ) : null}
                </div>
            )}
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow title="Memory enabled">
                        <div className="flex justify-start lg:justify-end">
                            <Switch
                                checked={formState.memoryEnabled}
                                disabled={
                                    !(canEdit && (hasModelsSelected || formState.memoryEnabled))
                                }
                                onCheckedChange={(checked) =>
                                    setFormState((current) => ({
                                        ...current,
                                        memoryEnabled: checked,
                                    }))
                                }
                            />
                        </div>
                    </SettingsRow>

                    {memoryModelSlots.map((slot) => (
                        <React.Fragment key={slot.key}>
                            <Separator />
                            <MemoryModelSelect
                                description={slot.description}
                                disabled={!canEdit || modelOptions.length === 0}
                                label={slot.label}
                                onValueChange={(value) =>
                                    setFormState((current) => ({
                                        ...current,
                                        [slot.key]: value,
                                    }))
                                }
                                options={modelOptions}
                                value={formState[slot.key]}
                            />
                        </React.Fragment>
                    ))}
                </Card>
            </CardFrame>
        </div>
    );
}
