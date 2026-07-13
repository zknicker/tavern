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
import { useModelInventory } from '../../../hooks/models/use-model-inventory.ts';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { trpc } from '../../../lib/trpc.tsx';

/**
 * Image generation runs as a direct capability call, so only models tagged with
 * the imageGeneration capability are offered. "Off" clears the selection.
 */
const offValue = 'off';

export function ImageGenerationSection() {
    const utils = trpc.useUtils();
    const selectionsQuery = trpc.model.capabilitySelections.useQuery(
        undefined,
        queryPolicy.agentRuntimeSnapshot
    );
    const saveSelections = trpc.model.saveCapabilitySelections.useMutation({
        async onSuccess() {
            await utils.model.capabilitySelections.invalidate();
        },
    });
    const inventoryQuery = useModelInventory();

    const options = (inventoryQuery.data?.providers ?? [])
        .flatMap((provider) =>
            provider.models
                .filter((model) => model.capability === 'imageGeneration')
                .map((model) => ({
                    label: model.displayName,
                    provider: provider.provider,
                    value: `${provider.provider}/${model.modelId}`,
                }))
        )
        .sort(
            (left, right) =>
                left.label.localeCompare(right.label) || left.provider.localeCompare(right.provider)
        );

    const selection = selectionsQuery.data?.selections.imageGeneration ?? null;
    const value = selection ? `${selection.provider}/${selection.model}` : offValue;
    const selectedLabel = selection
        ? (options.find((option) => option.value === value)?.label ?? value)
        : 'Off';
    const hasImageModels = options.length > 0;

    return (
        <SettingsSection title="Image Generation">
            <SettingsGroup>
                <SettingsRow
                    description={
                        <>
                            <span className="block">Model agents use to generate images.</span>
                            {hasImageModels ? null : (
                                <span className="block">
                                    Connect OpenAI in Model access to enable image models.
                                </span>
                            )}
                        </>
                    }
                    error={saveSelections.error?.message ?? null}
                    title="Image generation"
                    trailingWidth="control"
                >
                    <Select
                        disabled={selectionsQuery.isPending || saveSelections.isPending}
                        onValueChange={(next) =>
                            saveSelections.mutate({
                                selections: {
                                    imageGeneration:
                                        next && next !== offValue ? parseModelValue(next) : null,
                                },
                            })
                        }
                        value={value}
                    >
                        <SelectTrigger aria-label="Image generation model">
                            <SelectValue placeholder="Off">{selectedLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={offValue}>Off</SelectItem>
                            {options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    <span className="block min-w-0">
                                        <span className="block truncate">{option.label}</span>
                                        <span className="block truncate text-meta text-muted-foreground">
                                            {option.provider}
                                        </span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}

function parseModelValue(value: string): { model: string; provider: string } | null {
    const separator = value.indexOf('/');
    if (separator <= 0) {
        return null;
    }
    return {
        model: value.slice(separator + 1),
        provider: value.slice(0, separator),
    };
}
