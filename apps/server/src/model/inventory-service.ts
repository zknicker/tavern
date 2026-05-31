import { formatAgentRuntimeModelRef, parseAgentRuntimeModelRef } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { emitModelUpdated } from '../api/invalidation-events.ts';
import { loadProviderInventory, saveProviderInventory } from './inventory-cache.ts';
import {
    addCatalogModelInputSchema,
    deleteCatalogModelInputSchema,
    type ModelInventory,
    type ModelInventoryProvider,
    type ModelProviderId,
    modelInventorySchema,
} from './inventory-contracts.ts';
import {
    createCatalogInventoryRecord,
    getModelProviderDisplayName,
    listModelProviderConnections,
    modelInventoryProviders,
    sortModels,
} from './provider-inventory.ts';

type CatalogModelProviderId = (typeof modelInventoryProviders)[number];

function isCatalogModelProvider(provider: ModelProviderId): provider is CatalogModelProviderId {
    return modelInventoryProviders.some((candidate) => candidate === provider);
}

function listRefsForProvider(modelRefs: Set<string>, provider: CatalogModelProviderId) {
    return [...modelRefs].filter((modelRef) => modelRef.startsWith(`${provider}/`));
}

function createFallbackInventoryRecord(modelRef: string) {
    const { modelId, provider } = parseAgentRuntimeModelRef(modelRef);

    return createCatalogInventoryRecord({
        modelId,
        provider,
    });
}

async function buildProviderInventory(input: {
    inUseModelRefs: Set<string>;
    provider: CatalogModelProviderId;
    agentRuntimeConnections: Awaited<ReturnType<typeof listModelProviderConnections>>;
    usageLabelsByModelRef: Map<string, string[]>;
}) {
    const snapshot = await loadProviderInventory(input.provider);
    const connection = input.agentRuntimeConnections[input.provider];
    const modelsByRef = new Map(snapshot.models.map((model) => [model.ref, model] as const));

    for (const modelRef of listRefsForProvider(input.inUseModelRefs, input.provider)) {
        if (!modelsByRef.has(modelRef)) {
            modelsByRef.set(modelRef, createFallbackInventoryRecord(modelRef));
        }
    }

    return {
        displayName: getModelProviderDisplayName(input.provider),
        isConnected: connection.isConnected,
        models: sortModels([...modelsByRef.values()]).map((model) => {
            const usageLabels = input.usageLabelsByModelRef.get(model.ref) ?? [];

            return {
                ...model,
                canDelete: usageLabels.length === 0,
                inUse: usageLabels.length > 0,
                usageLabels,
            };
        }),
        provider: input.provider,
        state: connection.isConnected ? 'connected' : 'not-configured',
        stateMessage: connection.stateMessage,
    } satisfies ModelInventoryProvider;
}

export async function listModelInventory(): Promise<ModelInventory> {
    const agentRuntimeConnections = await listModelProviderConnections();

    return modelInventorySchema.parse({
        providers: await Promise.all(
            modelInventoryProviders.map((provider) =>
                buildProviderInventory({
                    inUseModelRefs: new Set(),
                    provider,
                    agentRuntimeConnections,
                    usageLabelsByModelRef: new Map(),
                })
            )
        ),
    });
}

export async function addCatalogModel(input: unknown) {
    const parsed = addCatalogModelInputSchema.parse(input);

    if (!isCatalogModelProvider(parsed.provider)) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${parsed.provider} is not supported in the Tavern model catalog.`,
        });
    }

    const model = createCatalogInventoryRecord(parsed);
    const snapshot = await loadProviderInventory(parsed.provider);

    if (snapshot.models.some((candidate) => candidate.ref === model.ref)) {
        throw new TRPCError({
            code: 'CONFLICT',
            message: `${formatAgentRuntimeModelRef(model)} is already in the Tavern model catalog.`,
        });
    }

    await saveProviderInventory({
        ...snapshot,
        models: sortModels([...snapshot.models, model]),
        syncedAt: new Date().toISOString(),
    });
    emitModelUpdated();

    return await listModelInventory();
}

export async function deleteCatalogModel(input: unknown) {
    const parsed = deleteCatalogModelInputSchema.parse(input);
    const { provider } = parseAgentRuntimeModelRef(parsed.modelRef);
    const inventory = await loadProviderInventory(provider);

    const nextModels = inventory.models.filter((model) => model.ref !== parsed.modelRef);

    if (nextModels.length === inventory.models.length) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: `${parsed.modelRef} is not in the Tavern model catalog.`,
        });
    }

    await saveProviderInventory({
        ...inventory,
        models: nextModels,
        syncedAt: new Date().toISOString(),
    });
    emitModelUpdated();

    return await listModelInventory();
}
