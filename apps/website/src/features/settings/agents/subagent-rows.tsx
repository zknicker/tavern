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

type Model = ModelListOutput['models'][number];

export type SubagentEffortValue = 'high' | 'low' | 'medium' | 'minimal' | 'none' | 'xhigh';

export interface SubagentModelEntry {
    baseUrl?: string;
    model: string;
    provider: string;
}

const inheritValue = '__inherit__';

const subagentEffortOptions: { label: string; value: SubagentEffortValue }[] = [
    { label: 'None', value: 'none' },
    { label: 'Minimal', value: 'minimal' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Extra high', value: 'xhigh' },
];

export function SubagentRows({
    disabled,
    modelOptions,
    onSubagentEffortChange,
    onSubagentModelChange,
    subagentEffort,
    subagentModel,
}: {
    disabled: boolean;
    modelOptions: Model[];
    onSubagentEffortChange: (next: SubagentEffortValue | null) => void;
    onSubagentModelChange: (next: SubagentModelEntry | null) => void;
    subagentEffort: SubagentEffortValue | null;
    subagentModel: SubagentModelEntry | null;
}) {
    const choices = listSubagentModelChoices(modelOptions);
    const selectedRef = findSubagentModelRef(modelOptions, subagentModel);
    const selectedChoice = findModelByRef(choices, selectedRef);
    const effortLabel =
        subagentEffortOptions.find((option) => option.value === subagentEffort)?.label ?? 'Inherit';

    return (
        <>
            <SettingsRow description="Used for delegated work." title="Subagent model">
                <Select
                    disabled={disabled}
                    onValueChange={(nextValue) => {
                        if (nextValue === null) {
                            return;
                        }
                        const modelRef = subagentModelRefFromSelection(nextValue);

                        if (modelRef === null) {
                            onSubagentModelChange(null);
                            return;
                        }

                        const choice = findModelByRef(choices, modelRef);

                        if (choice) {
                            onSubagentModelChange({
                                model: choice.modelId,
                                provider: choice.provider,
                            });
                        }
                    }}
                    value={
                        selectedRef ??
                        (subagentModel
                            ? `${subagentModel.provider}/${subagentModel.model}`
                            : inheritValue)
                    }
                >
                    <SelectTrigger className="h-auto min-h-12 py-2">
                        <SelectValue
                            className="min-w-0 flex-1 whitespace-normal"
                            placeholder="Choose subagent model"
                        >
                            {selectedChoice ? (
                                <SubagentModelLabel model={selectedChoice} />
                            ) : (
                                (subagentModel &&
                                    `${subagentModel.provider}/${subagentModel.model}`) ||
                                'Inherit primary model'
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={inheritValue}>Inherit primary model</SelectItem>
                        {choices.map((choice) => (
                            <SelectItem key={choice.ref} value={choice.ref}>
                                <SubagentModelLabel model={choice} />
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </SettingsRow>

            <Separator />

            <SettingsRow description="Thinking effort for delegated work." title="Subagent effort">
                <Select
                    disabled={disabled}
                    onValueChange={(nextValue) => {
                        if (nextValue === null) {
                            return;
                        }
                        onSubagentEffortChange(subagentEffortFromSelection(nextValue));
                    }}
                    value={subagentEffort ?? inheritValue}
                >
                    <SelectTrigger className="h-auto min-h-12 py-2">
                        <SelectValue
                            className="min-w-0 flex-1 whitespace-normal"
                            placeholder="Choose effort"
                        >
                            {effortLabel}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={inheritValue}>Inherit</SelectItem>
                        {subagentEffortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </SettingsRow>
        </>
    );
}

export function subagentModelRefFromSelection(value: string): null | string {
    return value === inheritValue ? null : value;
}

export function subagentEffortFromSelection(value: string): SubagentEffortValue | null {
    return subagentEffortOptions.find((option) => option.value === value)?.value ?? null;
}

export function findModelByRef(models: Model[], ref: null | string): Model | null {
    return ref ? (models.find((model) => model.ref === ref) ?? null) : null;
}

export function findSubagentModelRef(
    models: Model[],
    entry: SubagentModelEntry | null
): null | string {
    if (!entry) {
        return null;
    }

    return (
        models.find((model) => model.provider === entry.provider && model.modelId === entry.model)
            ?.ref ?? null
    );
}

export function listSubagentModelChoices(models: Model[]): Model[] {
    return [...models].sort(
        (left, right) =>
            left.name.localeCompare(right.name) || left.provider.localeCompare(right.provider)
    );
}

function SubagentModelLabel({ model }: { model: Model }) {
    return (
        <span className="block min-w-0">
            <span className="block truncate">{model.name}</span>
            <span className="block truncate text-muted-foreground text-xs">{model.provider}</span>
        </span>
    );
}
