import {
    type AgentRuntimeMemorySettings,
    type AgentRuntimeModels,
    formatAgentRuntimeModelRef,
    parseAgentRuntimeModelRef,
} from '@tavern/agent-runtime-protocol';
import { TRPCError } from '@trpc/server';
import { emitModelUpdated } from '../api/invalidation-events.ts';
import { getMemorySettings } from '../memory/service.ts';
import { loadProviderInventory, saveProviderInventory } from './inventory-cache.ts';
import {
    addCatalogModelInputSchema,
    deleteCatalogModelInputSchema,
    type ModelInventory,
    type ModelInventoryProvider,
    type ModelProviderId,
    modelInventorySchema,
} from './inventory-contracts.ts';
import { listInUseModelRefs, listModelUsageLabels } from './policy.ts';
import {
    createCatalogInventoryRecord,
    getModelProviderDisplayName,
    listModelProviderConnections,
    modelInventoryProviders,
    sortModels,
} from './provider-inventory.ts';

const emptyAgentRuntimeModels: AgentRuntimeModels = {
    agents: [],
    configuredModels: [],
    defaults: {
        fallbackModels: [],
        primaryModel: null,
    },
    defaultsThinkingLevel: null,
    subAgentDefaultModel: null,
    subAgentThinkingLevel: null,
    updatedAt: null,
};

function toPolicyMemorySettings(
    settings: Awaited<ReturnType<typeof getMemorySettings>>
): AgentRuntimeMemorySettings | null {
    if (!settings) {
        return null;
    }

    return {
        dreamModel: settings.dreamModel ? parseAgentRuntimeModelRef(settings.dreamModel) : null,
        knowledgeModel: settings.knowledgeModel
            ? parseAgentRuntimeModelRef(settings.knowledgeModel)
            : null,
        memoryEnabled: settings.memoryEnabled,
        persistenceModel: settings.persistenceModel
            ? parseAgentRuntimeModelRef(settings.persistenceModel)
            : null,
        updatedAt: settings.updatedAt,
        workingModel: settings.workingModel
            ? parseAgentRuntimeModelRef(settings.workingModel)
            : null,
    };
}

function listRefsForProvider(modelRefs: Set<string>, provider: ModelProviderId) {
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
    provider: ModelProviderId;
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
    const [memorySettings, agentRuntimeConnections] = await Promise.all([
        getMemorySettings(),
        listModelProviderConnections(),
    ]);
    const nextAgentRuntimeModels = emptyAgentRuntimeModels;
    const policyMemorySettings = toPolicyMemorySettings(memorySettings);
    const usageLabelsByModelRef = listModelUsageLabels(
        nextAgentRuntimeModels,
        policyMemorySettings
    );
    const inUseModelRefs = listInUseModelRefs(nextAgentRuntimeModels, policyMemorySettings);

    return modelInventorySchema.parse({
        providers: await Promise.all(
            modelInventoryProviders.map((provider) =>
                buildProviderInventory({
                    inUseModelRefs,
                    provider,
                    agentRuntimeConnections,
                    usageLabelsByModelRef,
                })
            )
        ),
    });
}

export async function addCatalogModel(input: unknown) {
    const parsed = addCatalogModelInputSchema.parse(input);
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
    const [inventory, memorySettings] = await Promise.all([
        loadProviderInventory(provider),
        getMemorySettings(),
    ]);
    const policyMemorySettings = toPolicyMemorySettings(memorySettings);
    const usageLabels = listModelUsageLabels(emptyAgentRuntimeModels, policyMemorySettings).get(
        parsed.modelRef
    );

    if (usageLabels && usageLabels.length > 0) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot delete ${parsed.modelRef} because it is still in use.`,
        });
    }

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
