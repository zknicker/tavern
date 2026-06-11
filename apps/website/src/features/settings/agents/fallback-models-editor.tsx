import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import type { ModelListOutput } from '../../../lib/trpc.tsx';

type Model = ModelListOutput['models'][number];

export interface FallbackModelEntry {
    baseUrl?: string;
    model: string;
    provider: string;
}

export function FallbackModelsEditor({
    disabled,
    fallbackModels,
    modelOptions,
    onChange,
    primaryModelRef,
}: {
    disabled: boolean;
    fallbackModels: FallbackModelEntry[];
    modelOptions: Model[];
    onChange: (next: FallbackModelEntry[]) => void;
    primaryModelRef: null | string;
}) {
    const choices = listFallbackChoices({
        fallbackModels,
        models: modelOptions,
        primaryModelRef,
    });

    return (
        <div className="flex flex-col gap-2">
            {fallbackModels.map((entry, index) => {
                const match = findFallbackModel(modelOptions, entry);

                return (
                    <div
                        className="flex items-center gap-2 rounded-lg bg-muted py-1.5 ps-3 pe-1.5 dark:bg-input/32"
                        key={`${entry.provider}/${entry.model}`}
                    >
                        <span className="block min-w-0 flex-1">
                            <span className="block truncate text-sm">
                                {match?.name ?? `${entry.provider}/${entry.model}`}
                            </span>
                            <span className="block truncate text-muted-foreground text-xs">
                                {match?.provider ?? entry.provider}
                            </span>
                        </span>
                        <Button
                            aria-label="Remove fallback model"
                            disabled={disabled}
                            onClick={() => onChange(removeFallbackAt(fallbackModels, index))}
                            size="icon-sm"
                            variant="ghost"
                        >
                            <Icon icon={Cancel01Icon} />
                        </Button>
                    </div>
                );
            })}

            <Select
                disabled={disabled || choices.length === 0}
                onValueChange={(modelRef) => {
                    const choice = choices.find((model) => model.ref === modelRef);

                    if (!choice) {
                        return;
                    }

                    onChange(
                        appendFallback(fallbackModels, {
                            model: choice.modelId,
                            provider: choice.provider,
                        })
                    );
                }}
                value=""
            >
                <SelectTrigger className="h-auto min-h-12 py-2">
                    <SelectValue className="min-w-0 flex-1 whitespace-normal">
                        Add fallback
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {choices.map((choice) => (
                        <SelectItem key={choice.ref} value={choice.ref}>
                            <FallbackChoiceLabel model={choice} />
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export function appendFallback(
    list: FallbackModelEntry[],
    entry: FallbackModelEntry
): FallbackModelEntry[] {
    return [...list, entry];
}

export function removeFallbackAt(list: FallbackModelEntry[], index: number): FallbackModelEntry[] {
    return list.filter((_, entryIndex) => entryIndex !== index);
}

export function listFallbackChoices({
    fallbackModels,
    models,
    primaryModelRef,
}: {
    fallbackModels: FallbackModelEntry[];
    models: Model[];
    primaryModelRef: null | string;
}): Model[] {
    return models
        .filter((model) => model.ref !== primaryModelRef)
        .filter((model) => !findFallbackEntry(fallbackModels, model))
        .sort(
            (left, right) =>
                left.name.localeCompare(right.name) || left.provider.localeCompare(right.provider)
        );
}

function FallbackChoiceLabel({ model }: { model: Model }) {
    return (
        <span className="block min-w-0">
            <span className="block truncate">{model.name}</span>
            <span className="block truncate text-muted-foreground text-xs">{model.provider}</span>
        </span>
    );
}

function findFallbackModel(models: Model[], entry: FallbackModelEntry) {
    return (
        models.find(
            (model) => model.provider === entry.provider && model.modelId === entry.model
        ) ?? null
    );
}

function findFallbackEntry(fallbackModels: FallbackModelEntry[], model: Model) {
    return (
        fallbackModels.find(
            (entry) => entry.provider === model.provider && entry.model === model.modelId
        ) ?? null
    );
}
