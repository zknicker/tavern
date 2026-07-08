import type { AgentRuntimeModelCategory, AgentRuntimeModelName } from '@tavern/api';
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
import { useCapability } from '../../../hooks/connections/use-capability.ts';
import { useModelInventory } from '../../../hooks/models/use-model-inventory.ts';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { trpc } from '../../../lib/trpc.tsx';

/**
 * Background Memory work runs as direct model calls, so only providers with a
 * completions API are offered. Automatic follows the runtime default.
 */
const workerModelProviders = new Set(['openai', 'openrouter', 'openai-compatible', 'custom']);
const automaticValue = 'automatic';

const categoryRows = [
    {
        category: 'fast',
        description: 'Extraction and background distillation.',
        title: 'Fast',
    },
    {
        category: 'standard',
        description: 'Dreaming and skill review.',
        title: 'Standard',
    },
    {
        category: 'deep',
        description: 'Curation.',
        title: 'Deep',
    },
    {
        category: 'visual',
        description: 'Image understanding.',
        title: 'Visual',
    },
] as const satisfies ReadonlyArray<{
    category: AgentRuntimeModelCategory;
    description: string;
    title: string;
}>;

export function BackgroundModelsSection() {
    const utils = trpc.useUtils();
    const settingsQuery = trpc.model.categorySettings.useQuery(
        undefined,
        queryPolicy.agentRuntimeSnapshot
    );
    const saveSettings = trpc.model.saveCategorySettings.useMutation({
        async onSuccess() {
            await utils.model.categorySettings.invalidate();
        },
    });
    const inventoryQuery = useModelInventory();
    const extraction = useCapability('memoryExtraction');
    const dreaming = useCapability('memoryDreaming');
    const resolvedByCategory = {
        ...readResolvedCategories(extraction.status?.metadataJson ?? null),
        ...readResolvedCategories(dreaming.status?.metadataJson ?? null),
    };

    const options = (inventoryQuery.data?.providers ?? [])
        .filter((provider) => workerModelProviders.has(provider.provider))
        .flatMap((provider) =>
            provider.models.map((model) => ({
                label: model.displayName,
                provider: provider.provider,
                value: `${provider.provider}/${model.modelId}`,
            }))
        )
        .sort(
            (left, right) =>
                left.label.localeCompare(right.label) || left.provider.localeCompare(right.provider)
        );

    return (
        <SettingsSection title="Background Models">
            <SettingsGroup>
                {categoryRows.map((row, index) => {
                    const selection = settingsQuery.data?.categories[row.category] ?? null;
                    const value = selection
                        ? `${selection.provider}/${selection.model}`
                        : automaticValue;
                    const resolved = resolvedByCategory[row.category];
                    const automaticLabel = resolved ? `Automatic (${resolved})` : 'Automatic';
                    const selectedLabel = selection
                        ? (options.find((option) => option.value === value)?.label ?? value)
                        : automaticLabel;

                    return (
                        <div key={row.category}>
                            {index > 0 ? <Separator /> : null}
                            <SettingsRow
                                description={row.description}
                                error={index === 0 ? (saveSettings.error?.message ?? null) : null}
                                title={row.title}
                                trailingWidth="control"
                            >
                                <Select
                                    disabled={settingsQuery.isPending || saveSettings.isPending}
                                    onValueChange={(next) =>
                                        saveSettings.mutate({
                                            categories: {
                                                [row.category]: next ? parseModelValue(next) : null,
                                            },
                                        })
                                    }
                                    value={value}
                                >
                                    <SelectTrigger aria-label={`${row.title} model`}>
                                        <SelectValue placeholder="Automatic">
                                            {selectedLabel}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={automaticValue}>
                                            {automaticLabel}
                                        </SelectItem>
                                        {options.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                <span className="block min-w-0">
                                                    <span className="block truncate">
                                                        {option.label}
                                                    </span>
                                                    <span className="block truncate text-meta text-muted-foreground">
                                                        {option.provider}
                                                    </span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsRow>
                        </div>
                    );
                })}
            </SettingsGroup>
        </SettingsSection>
    );
}

function parseModelValue(value: string): AgentRuntimeModelName | null {
    if (value === automaticValue) {
        return null;
    }
    const separator = value.indexOf('/');
    if (separator <= 0) {
        return null;
    }
    return {
        model: value.slice(separator + 1),
        provider: value.slice(0, separator) as AgentRuntimeModelName['provider'],
    };
}

function readResolvedCategories(metadataJson: string | null) {
    const empty: Partial<Record<AgentRuntimeModelCategory, string>> = {};
    if (!metadataJson) {
        return empty;
    }
    try {
        const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
        return {
            deep: typeof parsed.deep === 'string' ? parsed.deep : undefined,
            fast: typeof parsed.fast === 'string' ? parsed.fast : undefined,
            standard: typeof parsed.standard === 'string' ? parsed.standard : undefined,
            visual: typeof parsed.visual === 'string' ? parsed.visual : undefined,
        };
    } catch {
        return empty;
    }
}
