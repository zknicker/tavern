import { parseAgentRuntimeModelRef } from '@tavern/api';
import { listModelAccessStatuses } from '../model-access/service.ts';
import { getOpenRouterSettings } from '../openrouter/settings.ts';
import {
    type ModelInventorySnapshot,
    type ModelInventorySnapshotRecord,
    type ModelProviderId,
    modelInventorySnapshotSchema,
} from './inventory-contracts.ts';

export const modelInventoryProviders = [
    'codex',
    'openrouter',
] as const satisfies readonly ModelProviderId[];
type CatalogModelProviderId = (typeof modelInventoryProviders)[number];

const providerDisplayNames = {
    codex: 'Codex',
    openrouter: 'OpenRouter',
} as const satisfies Record<CatalogModelProviderId, string>;

const curatedModels = {
    codex: [
        ['gpt-5.5', 'GPT-5.5', 400_000],
        ['gpt-5.4', 'GPT-5.4', null],
        ['gpt-5.4-mini', 'GPT-5.4 Mini', null],
        ['gpt-5.3-codex', 'GPT-5.3 Codex', null],
        ['gpt-5.3-codex-spark', 'GPT-5.3 Codex Spark', null],
        ['gpt-5.2', 'GPT-5.2', null],
    ],
    openrouter: [['moonshotai/kimi-k2.5', 'Kimi K2.5', 262_144]],
} as const satisfies Record<
    CatalogModelProviderId,
    readonly (readonly [string, string, number | null])[]
>;

export type ModelProviderConnections = Record<
    CatalogModelProviderId,
    {
        isConnected: boolean;
        stateMessage: string;
    }
>;

export function getModelProviderDisplayName(provider: ModelProviderId) {
    return provider in providerDisplayNames
        ? providerDisplayNames[provider as keyof typeof providerDisplayNames]
        : titleizeModelId(provider);
}

export function createCatalogInventoryRecord(input: {
    contextWindow?: number | null;
    displayName?: string | null;
    modelId: string;
    provider: ModelProviderId;
}): ModelInventorySnapshotRecord {
    const modelId = input.modelId.trim();

    return {
        contextWindow: input.contextWindow ?? null,
        description: null,
        displayName: input.displayName?.trim() || titleizeModelId(modelId),
        modelId,
        provider: input.provider,
        ref: `${input.provider}/${modelId}`,
    };
}

export function createCuratedProviderInventory(provider: ModelProviderId): ModelInventorySnapshot {
    const models =
        provider in curatedModels ? curatedModels[provider as keyof typeof curatedModels] : [];

    return modelInventorySnapshotSchema.parse({
        models: sortModels(
            models.map(([modelId, displayName, contextWindow]) =>
                createCatalogInventoryRecord({
                    contextWindow,
                    displayName,
                    modelId,
                    provider,
                })
            )
        ),
        provider,
        syncedAt: new Date().toISOString(),
    });
}

export async function listModelProviderConnections(): Promise<ModelProviderConnections> {
    const [modelAccessStatuses, openRouterSettings] = await Promise.all([
        listModelAccessStatuses(),
        getOpenRouterSettings(),
    ]);
    const codexStatus = modelAccessStatuses.find((status) => status.id === 'codex') ?? null;

    return {
        codex: {
            isConnected: codexStatus?.state === 'live',
            stateMessage:
                codexStatus?.description ??
                'Codex availability could not be read from the runtime.',
        },
        openrouter: {
            isConnected: Boolean(openRouterSettings?.hasApiKey),
            stateMessage: openRouterSettings?.hasApiKey
                ? 'Connected to Tavern Vault'
                : 'Add an OpenRouter API key to use OpenRouter models.',
        },
    };
}

export function sortModels(models: ModelInventorySnapshotRecord[]) {
    return [...models].sort(
        (left, right) =>
            left.displayName.localeCompare(right.displayName) || left.ref.localeCompare(right.ref)
    );
}

export function inferCatalogModelName(modelRef: string) {
    const { modelId, provider } = parseAgentRuntimeModelRef(modelRef);
    const models =
        provider in curatedModels ? curatedModels[provider as keyof typeof curatedModels] : [];
    const curatedModel = models.find(([candidate]) => candidate === modelId);

    return curatedModel?.[1] ?? titleizeModelId(modelId);
}

function titleizeModelId(value: string) {
    return value
        .trim()
        .split(/[/:_-]+/g)
        .filter((segment) => segment.length > 0)
        .map((segment) =>
            segment
                .split('.')
                .map((part) => part[0]?.toUpperCase() + part.slice(1))
                .join('.')
        )
        .join(' ');
}
